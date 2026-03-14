#include <windows.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cwctype>
#include <filesystem>
#include <iomanip>
#include <memory>
#include <mutex>
#include <new>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

#include "apiCore.h"
#include "apiFileManager.h"
#include "apiMessages.h"
#include "apiObjects.h"
#include "apiPlayer.h"
#include "apiPlaylists.h"
#include "apiPlugin.h"
#include "apiThreading.h"

#ifndef IID_IAIMPPlugin
// The AIMP C++ SDK does not publish IID_IAIMPPlugin in apiPlugin.h. Alias it to IUnknown so
// QueryInterface can explicitly accept both spellings without inventing an unofficial GUID.
#define IID_IAIMPPlugin IID_IUnknown
#endif

namespace {

constexpr wchar_t kPluginName[] = L"CherryPlay AIMP Bridge";
constexpr wchar_t kPluginAuthor[] = L"CherryPlay";
constexpr wchar_t kPluginShortDescription[] =
    L"Streams AIMP playlist and playback snapshots to CherryPlayList over a named pipe.";
constexpr wchar_t kPluginFullDescription[] =
    L"Windows x64 read-only bridge plugin that publishes AIMP playlist and playback state to CherryPlayList.";
constexpr wchar_t kProtocolVersion[] = L"1.0.0";
constexpr wchar_t kPluginVersion[] = L"0.1.0";
constexpr wchar_t kPipeName[] = L"\\\\.\\pipe\\cherryplay-aimp-v1";
constexpr wchar_t kArchitecture[] = L"x64";
constexpr wchar_t kPlatform[] = L"win32";
constexpr std::chrono::milliseconds kHeartbeatInterval{5000};
constexpr std::chrono::milliseconds kPlaybackSnapshotMinInterval{500};
constexpr std::chrono::milliseconds kReconnectDelay{1000};
constexpr std::chrono::milliseconds kHandshakeResponseTimeout{1500};
constexpr std::chrono::milliseconds kProtocolMismatchReconnectBackoff{30000};
constexpr std::chrono::milliseconds kPipeReadPollInterval{50};

class ScopedHandle {
 public:
  ScopedHandle() = default;
  explicit ScopedHandle(HANDLE handle) : handle_(handle) {}
  ScopedHandle(const ScopedHandle&) = delete;
  ScopedHandle& operator=(const ScopedHandle&) = delete;

  ScopedHandle(ScopedHandle&& other) noexcept : handle_(other.handle_) {
    other.handle_ = INVALID_HANDLE_VALUE;
  }

  ScopedHandle& operator=(ScopedHandle&& other) noexcept {
    if (this != &other) {
      Reset();
      handle_ = other.handle_;
      other.handle_ = INVALID_HANDLE_VALUE;
    }
    return *this;
  }

  ~ScopedHandle() {
    Reset();
  }

  [[nodiscard]] HANDLE Get() const {
    return handle_;
  }

  [[nodiscard]] bool IsValid() const {
    return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE;
  }

  void Reset(HANDLE handle = INVALID_HANDLE_VALUE) {
    if (IsValid()) {
      CloseHandle(handle_);
    }
    handle_ = handle;
  }

  [[nodiscard]] HANDLE Release() {
    HANDLE released = handle_;
    handle_ = INVALID_HANDLE_VALUE;
    return released;
  }

 private:
  HANDLE handle_ = INVALID_HANDLE_VALUE;
};

template <typename T>
class ComPtr {
 public:
  ComPtr() = default;
  explicit ComPtr(T* value) : value_(value) {}

  ComPtr(const ComPtr& other) : value_(other.value_) {
    InternalAddRef();
  }

  ComPtr(ComPtr&& other) noexcept : value_(other.value_) {
    other.value_ = nullptr;
  }

  ~ComPtr() {
    InternalRelease();
  }

  ComPtr& operator=(const ComPtr& other) {
    if (this != &other) {
      InternalRelease();
      value_ = other.value_;
      InternalAddRef();
    }
    return *this;
  }

  ComPtr& operator=(ComPtr&& other) noexcept {
    if (this != &other) {
      InternalRelease();
      value_ = other.value_;
      other.value_ = nullptr;
    }
    return *this;
  }

  [[nodiscard]] T* Get() const {
    return value_;
  }

  [[nodiscard]] T** Put() {
    InternalRelease();
    value_ = nullptr;
    return &value_;
  }

  [[nodiscard]] T* const* GetAddressOf() const {
    return &value_;
  }

  [[nodiscard]] T* operator->() const {
    return value_;
  }

  [[nodiscard]] explicit operator bool() const {
    return value_ != nullptr;
  }

  void Reset(T* value = nullptr) {
    if (value_ != value) {
      InternalRelease();
      value_ = value;
    }
  }

  [[nodiscard]] T* Detach() {
    T* detached = value_;
    value_ = nullptr;
    return detached;
  }

 private:
  void InternalAddRef() {
    if (value_) {
      value_->AddRef();
    }
  }

  void InternalRelease() {
    if (value_) {
      value_->Release();
      value_ = nullptr;
    }
  }

  T* value_ = nullptr;
};

std::wstring GetIsoUtcNow() {
  SYSTEMTIME utc_time{};
  GetSystemTime(&utc_time);

  std::wostringstream stream;
  stream << std::setfill(L'0') << std::setw(4) << utc_time.wYear << L'-' << std::setw(2)
         << utc_time.wMonth << L'-' << std::setw(2) << utc_time.wDay << L'T' << std::setw(2)
         << utc_time.wHour << L':' << std::setw(2) << utc_time.wMinute << L':' << std::setw(2)
         << utc_time.wSecond << L'.' << std::setw(3) << utc_time.wMilliseconds << L'Z';
  return stream.str();
}

std::wstring GuidToWString(const GUID& guid) {
  wchar_t buffer[64]{};
  StringFromGUID2(guid, buffer, static_cast<int>(std::size(buffer)));
  std::wstring value(buffer);
  value.erase(std::remove(value.begin(), value.end(), L'{'), value.end());
  value.erase(std::remove(value.begin(), value.end(), L'}'), value.end());
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) {
    return static_cast<wchar_t>(::towlower(ch));
  });
  return value;
}

std::wstring GenerateInstanceId() {
  GUID guid{};
  if (CoCreateGuid(&guid) != S_OK) {
    return L"00000000-0000-0000-0000-000000000000";
  }
  return GuidToWString(guid);
}

void LogDiagnostic(const std::wstring& message) {
  std::wstring payload = L"[CherryPlayAimpPlugin] " + message + L"\n";
  OutputDebugStringW(payload.c_str());
}

std::string WideToUtf8(const std::wstring& value) {
  if (value.empty()) {
    return {};
  }

  const int length = WideCharToMultiByte(
      CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (length <= 0) {
    return {};
  }

  std::string output(static_cast<size_t>(length), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), output.data(),
                      length, nullptr, nullptr);
  return output;
}

std::string EscapeJson(const std::string& value) {
  std::ostringstream output;
  for (const unsigned char ch : value) {
    switch (ch) {
      case '\"':
        output << "\\\"";
        break;
      case '\\':
        output << "\\\\";
        break;
      case '\b':
        output << "\\b";
        break;
      case '\f':
        output << "\\f";
        break;
      case '\n':
        output << "\\n";
        break;
      case '\r':
        output << "\\r";
        break;
      case '\t':
        output << "\\t";
        break;
      default:
        if (ch < 0x20) {
          output << "\\u" << std::hex << std::setw(4) << std::setfill('0')
                 << static_cast<int>(ch) << std::dec;
        } else {
          output << static_cast<char>(ch);
        }
        break;
    }
  }
  return output.str();
}

std::string QuoteJson(const std::wstring& value) {
  return "\"" + EscapeJson(WideToUtf8(value)) + "\"";
}

std::wstring TrimOrFallback(std::wstring value, const std::wstring& fallback) {
  if (!value.empty()) {
    return value;
  }
  return fallback;
}

std::wstring ToLowerCopy(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t ch) {
    return static_cast<wchar_t>(::towlower(ch));
  });
  return value;
}

std::wstring ExtractTitleFromPath(const std::wstring& path) {
  if (path.empty()) {
    return L"Unknown Track";
  }

  try {
    std::filesystem::path fs_path(path);
    if (fs_path.has_stem()) {
      const std::wstring stem = fs_path.stem().wstring();
      if (!stem.empty()) {
        return stem;
      }
    }
  } catch (...) {
  }

  return path;
}

std::wstring GetAimpStringData(IAIMPString* value) {
  if (!value) {
    return {};
  }

  TChar* data = value->GetData();
  if (!data) {
    return {};
  }
  return data;
}

ComPtr<IAIMPString> ReadStringObject(IAIMPPropertyList* property_list, int property_id) {
  if (!property_list) {
    return {};
  }

  IAIMPString* value = nullptr;
  if (FAILED(property_list->GetValueAsObject(property_id, IID_IAIMPString,
                                             reinterpret_cast<void**>(&value)))) {
    return {};
  }
  return ComPtr<IAIMPString>(value);
}

std::wstring ReadStringProperty(IAIMPPropertyList* property_list, int property_id) {
  return GetAimpStringData(ReadStringObject(property_list, property_id).Get());
}

std::optional<int64_t> ReadDurationMs(IAIMPPropertyList* property_list, int property_id) {
  if (!property_list) {
    return std::nullopt;
  }

  double seconds = 0.0;
  if (FAILED(property_list->GetValueAsFloat(property_id, &seconds))) {
    return std::nullopt;
  }

  if (seconds < 0.0) {
    return std::nullopt;
  }

  return static_cast<int64_t>(seconds * 1000.0 + 0.5);
}

std::optional<int> ReadIntProperty(IAIMPPropertyList* property_list, int property_id) {
  if (!property_list) {
    return std::nullopt;
  }

  int value = 0;
  if (FAILED(property_list->GetValueAsInt32(property_id, &value))) {
    return std::nullopt;
  }
  return value;
}

template <typename T>
ComPtr<T> QueryComInterface(IUnknown* unknown, REFIID iid) {
  if (!unknown) {
    return {};
  }

  T* value = nullptr;
  if (FAILED(unknown->QueryInterface(iid, reinterpret_cast<void**>(&value)))) {
    return {};
  }
  return ComPtr<T>(value);
}

template <typename T>
ComPtr<T> QueryCoreService(IAIMPCore* core, REFIID iid) {
  if (!core) {
    return {};
  }

  T* value = nullptr;
  if (FAILED(core->QueryInterface(iid, reinterpret_cast<void**>(&value)))) {
    return {};
  }
  return ComPtr<T>(value);
}

enum class TrackIdentityStrategy {
  NativeTrackId,
  FilePath,
  TitleDuration,
};

enum class HelloAckDecision {
  Accepted,
  TimedOut,
  ProtocolMismatch,
  Rejected,
};

struct TrackReference {
  std::optional<std::wstring> native_track_id;
  std::optional<std::wstring> file_path;
  std::optional<std::wstring> title;
  std::optional<int64_t> duration_ms;

  bool operator==(const TrackReference&) const = default;
};

struct PlaylistTrack {
  TrackReference reference;
  std::wstring title;
  std::optional<std::wstring> artist;
  std::optional<std::wstring> album;
  std::optional<int64_t> duration_ms;
  int position_in_queue = 0;
  bool is_active = false;

  bool operator==(const PlaylistTrack&) const = default;
};

struct PlaylistStateData {
  std::wstring playlist_id;
  std::wstring playlist_name;
  std::vector<PlaylistTrack> tracks;
  std::optional<TrackReference> active_track;

  bool operator==(const PlaylistStateData&) const = default;
};

struct PlaylistSnapshot {
  PlaylistStateData data;
  uint64_t revision = 0;
};

struct PlaybackStateData {
  std::wstring status = L"stopped";
  std::optional<TrackReference> current_track;
  int64_t position_ms = 0;
  std::optional<int64_t> duration_ms;
  std::optional<int> volume_percent;
  bool is_muted = false;

  bool operator==(const PlaybackStateData&) const = default;
};

struct PlaybackSnapshot {
  PlaybackStateData data;
  uint64_t revision = 0;
};

struct HelloAckResult {
  HelloAckDecision decision = HelloAckDecision::TimedOut;
  std::wstring server_protocol_version;
  std::wstring error_code;
  std::wstring detail;
};

TrackReference MakeTrackReference(std::wstring native_track_id, std::wstring file_path,
                                  std::wstring title, std::optional<int64_t> duration_ms) {
  if (!native_track_id.empty()) {
    return TrackReference{native_track_id, std::nullopt, std::nullopt, std::nullopt};
  }

  if (!file_path.empty()) {
    return TrackReference{std::nullopt, file_path, std::nullopt, std::nullopt};
  }

  return TrackReference{std::nullopt, std::nullopt, TrimOrFallback(std::move(title), L"Unknown Track"),
                        duration_ms.value_or(0)};
}

std::wstring BuildCanonicalTrackKey(const TrackReference& reference) {
  if (reference.native_track_id) {
    return L"native:" + *reference.native_track_id;
  }

  if (reference.file_path) {
    return L"path:" + ToLowerCopy(*reference.file_path);
  }

  return L"title-duration:" + ToLowerCopy(reference.title.value_or(L"unknown track")) + L"::" +
         std::to_wstring(reference.duration_ms.value_or(0));
}

std::string SerializeTrackReference(const TrackReference& reference) {
  std::ostringstream json;
  json << '{';

  bool first = true;
  auto write_field = [&](const char* name, const std::wstring& value) {
    if (!first) {
      json << ',';
    }
    first = false;
    json << '"' << name << "\":" << QuoteJson(value);
  };

  if (reference.native_track_id) {
    write_field("nativeTrackId", *reference.native_track_id);
  }
  if (reference.file_path) {
    write_field("filePath", *reference.file_path);
  }
  if (reference.title) {
    write_field("title", *reference.title);
  }
  if (reference.duration_ms) {
    if (!first) {
      json << ',';
    }
    first = false;
    json << "\"durationMs\":" << *reference.duration_ms;
  }

  json << '}';
  return json.str();
}

std::optional<std::string> ExtractJsonStringField(std::string_view json, std::string_view field_name) {
  const std::string token = "\"" + std::string(field_name) + "\"";
  const size_t key_pos = json.find(token);
  if (key_pos == std::string_view::npos) {
    return std::nullopt;
  }

  const size_t colon_pos = json.find(':', key_pos + token.size());
  if (colon_pos == std::string_view::npos) {
    return std::nullopt;
  }

  size_t value_start = colon_pos + 1;
  while (value_start < json.size() &&
         (json[value_start] == ' ' || json[value_start] == '\t' || json[value_start] == '\r' ||
          json[value_start] == '\n')) {
    ++value_start;
  }

  if (value_start >= json.size() || json[value_start] != '"') {
    return std::nullopt;
  }

  ++value_start;
  std::string value;
  bool escaped = false;
  for (size_t index = value_start; index < json.size(); ++index) {
    const char ch = json[index];
    if (escaped) {
      switch (ch) {
        case '"':
        case '\\':
        case '/':
          value.push_back(ch);
          break;
        case 'b':
          value.push_back('\b');
          break;
        case 'f':
          value.push_back('\f');
          break;
        case 'n':
          value.push_back('\n');
          break;
        case 'r':
          value.push_back('\r');
          break;
        case 't':
          value.push_back('\t');
          break;
        default:
          value.push_back(ch);
          break;
      }
      escaped = false;
      continue;
    }

    if (ch == '\\') {
      escaped = true;
      continue;
    }

    if (ch == '"') {
      return value;
    }

    value.push_back(ch);
  }

  return std::nullopt;
}

std::optional<bool> ExtractJsonBoolField(std::string_view json, std::string_view field_name) {
  const std::string token = "\"" + std::string(field_name) + "\"";
  const size_t key_pos = json.find(token);
  if (key_pos == std::string_view::npos) {
    return std::nullopt;
  }

  const size_t colon_pos = json.find(':', key_pos + token.size());
  if (colon_pos == std::string_view::npos) {
    return std::nullopt;
  }

  size_t value_start = colon_pos + 1;
  while (value_start < json.size() &&
         (json[value_start] == ' ' || json[value_start] == '\t' || json[value_start] == '\r' ||
          json[value_start] == '\n')) {
    ++value_start;
  }

  if (json.compare(value_start, 4, "true") == 0) {
    return true;
  }

  if (json.compare(value_start, 5, "false") == 0) {
    return false;
  }

  return std::nullopt;
}

std::wstring ReadAimpVersion(IAIMPCore* core) {
  const auto version_info = QueryCoreService<IAIMPServiceVersionInfo>(core, IID_IAIMPServiceVersionInfo);
  if (!version_info) {
    return L"unknown";
  }

  IAIMPString* value = nullptr;
  if (FAILED(version_info->FormatInfo(&value))) {
    return L"unknown";
  }

  ComPtr<IAIMPString> version_string(value);
  return TrimOrFallback(GetAimpStringData(version_string.Get()), L"unknown");
}

class CherryPlayAimpPlugin;

class SnapshotCollectionTask final : public IAIMPTask {
 public:
  SnapshotCollectionTask(CherryPlayAimpPlugin* plugin, bool retrack_playlist,
                         bool refresh_playlist, bool refresh_playback);

  HRESULT WINAPI QueryInterface(REFIID iid, void** object) override;
  ULONG WINAPI AddRef() override;
  ULONG WINAPI Release() override;

  void WINAPI Execute(IAIMPTaskOwner* owner) override;

 private:
  ~SnapshotCollectionTask() = default;

  CherryPlayAimpPlugin* plugin_ = nullptr;
  bool retrack_playlist_ = false;
  bool refresh_playlist_ = false;
  bool refresh_playback_ = false;
  std::atomic_ulong ref_count_{1};
};

class PluginPlaylistListener final : public IAIMPPlaylistListener {
 public:
  explicit PluginPlaylistListener(CherryPlayAimpPlugin* owner) : owner_(owner) {}

  HRESULT WINAPI QueryInterface(REFIID iid, void** object) override;
  ULONG WINAPI AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }
  ULONG WINAPI Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  void WINAPI Activated() override;
  void WINAPI Changed(LongWord flags) override;
  void WINAPI Removed() override;

 private:
  ~PluginPlaylistListener() = default;

  std::atomic_ulong ref_count_{1};
  CherryPlayAimpPlugin* owner_ = nullptr;
};

class PluginPlaylistManagerListener final : public IAIMPExtensionPlaylistManagerListener {
 public:
  explicit PluginPlaylistManagerListener(CherryPlayAimpPlugin* owner) : owner_(owner) {}

  HRESULT WINAPI QueryInterface(REFIID iid, void** object) override;
  ULONG WINAPI AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }
  ULONG WINAPI Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  void WINAPI PlaylistActivated(IAIMPPlaylist* playlist) override;
  void WINAPI PlaylistAdded(IAIMPPlaylist* playlist) override;
  void WINAPI PlaylistRemoved(IAIMPPlaylist* playlist) override;

 private:
  ~PluginPlaylistManagerListener() = default;

  std::atomic_ulong ref_count_{1};
  CherryPlayAimpPlugin* owner_ = nullptr;
};

class PluginMessageHook final : public IAIMPMessageHook {
 public:
  explicit PluginMessageHook(CherryPlayAimpPlugin* owner) : owner_(owner) {}

  HRESULT WINAPI QueryInterface(REFIID iid, void** object) override;
  ULONG WINAPI AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }
  ULONG WINAPI Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  void WINAPI CoreMessage(LongWord message, int param1, void* param2, HRESULT* result) override;

 private:
  ~PluginMessageHook() = default;

  std::atomic_ulong ref_count_{1};
  CherryPlayAimpPlugin* owner_ = nullptr;
};

class CherryPlayAimpPlugin final : public IAIMPPlugin {
  friend class SnapshotCollectionTask;

 public:
  CherryPlayAimpPlugin() = default;

  HRESULT WINAPI QueryInterface(REFIID iid, void** object) override {
    if (!object) {
      return E_POINTER;
    }

    if (iid == IID_IUnknown || iid == IID_IAIMPPlugin) {
      *object = static_cast<IAIMPPlugin*>(this);
      AddRef();
      return S_OK;
    }

    *object = nullptr;
    return E_NOINTERFACE;
  }

  ULONG WINAPI AddRef() override {
    return static_cast<ULONG>(++ref_count_);
  }

  ULONG WINAPI Release() override {
    const ULONG value = static_cast<ULONG>(--ref_count_);
    if (value == 0) {
      delete this;
    }
    return value;
  }

  TChar* WINAPI InfoGet(int index) override {
    switch (index) {
      case AIMP_PLUGIN_INFO_NAME:
        return const_cast<TChar*>(kPluginName);
      case AIMP_PLUGIN_INFO_AUTHOR:
        return const_cast<TChar*>(kPluginAuthor);
      case AIMP_PLUGIN_INFO_SHORT_DESCRIPTION:
        return const_cast<TChar*>(kPluginShortDescription);
      case AIMP_PLUGIN_INFO_FULL_DESCRIPTION:
        return const_cast<TChar*>(kPluginFullDescription);
      default:
        return const_cast<TChar*>(L"");
    }
  }

  LongWord WINAPI InfoGetCategories() override {
    return AIMP_PLUGIN_CATEGORY_ADDONS;
  }

  HRESULT WINAPI Initialize(IAIMPCore* core) override {
    if (!core) {
      return E_POINTER;
    }

    std::scoped_lock lock(state_mutex_);

    if (initialized_) {
      return S_FALSE;
    }

    core_ = core;
    core_->AddRef();

    playlist_manager_ = QueryCoreService<IAIMPServicePlaylistManager>(core_, IID_IAIMPServicePlaylistManager);
    player_ = QueryCoreService<IAIMPServicePlayer>(core_, IID_IAIMPServicePlayer);
    message_dispatcher_ =
        QueryCoreService<IAIMPServiceMessageDispatcher>(core_, IID_IAIMPServiceMessageDispatcher);
    threads_service_ = QueryCoreService<IAIMPServiceThreads>(core_, IID_IAIMPServiceThreads);
    aimp_version_ = ReadAimpVersion(core_);
    instance_id_ = GenerateInstanceId();

    playlist_listener_.Reset(new PluginPlaylistListener(this));
    playlist_manager_listener_.Reset(new PluginPlaylistManagerListener(this));
    message_hook_.Reset(new PluginMessageHook(this));

    if (playlist_manager_ && playlist_manager_listener_) {
      core_->RegisterExtension(IID_IAIMPServicePlaylistManager, playlist_manager_listener_.Get());
    }

    if (message_dispatcher_ && message_hook_) {
      message_dispatcher_->Hook(message_hook_.Get());
    }

    StartSnapshotWorkerLocked();
    transport_stop_requested_ = false;
    transport_thread_ = std::thread([this]() { TransportLoop(); });

    initialized_ = true;
    state_cv_.notify_all();
    return S_OK;
  }

  HRESULT WINAPI Finalize() override {
    // Stop snapshot first so it is not inside AIMP SDK when we join transport.
    StopSnapshotWorker();
    StopTransport(GoodbyeReason::PluginShutdown,
                  L"AIMP is unloading the CherryPlay bridge plugin.");

    std::scoped_lock lock(state_mutex_);

    if (!initialized_) {
      return S_FALSE;
    }

    DetachObservedPlaylistLocked();

    if (message_dispatcher_ && message_hook_) {
      message_dispatcher_->Unhook(message_hook_.Get());
    }

    if (core_ && playlist_manager_listener_) {
      core_->UnregisterExtension(playlist_manager_listener_.Get());
    }

    message_hook_.Reset();
    playlist_manager_listener_.Reset();
    playlist_listener_.Reset();
    message_dispatcher_.Reset();
    threads_service_.Reset();
    player_.Reset();
    playlist_manager_.Reset();

    if (core_) {
      core_->Release();
      core_ = nullptr;
    }

    initialized_ = false;
    return S_OK;
  }

  void WINAPI SystemNotification(int notify_id, IUnknown* data) override {
    (void)data;
    if (notify_id == AIMP_SYSTEM_NOTIFICATION_SERVICE_ADDED ||
        notify_id == AIMP_SYSTEM_NOTIFICATION_SERVICE_REMOVED) {
      QueueSnapshotRefresh(false, true, false);
    }
  }

  void OnPlaylistActivated() {
    QueueSnapshotRefresh(true, true, true);
  }

  void OnPlaylistChanged(LongWord flags) {
    if ((flags & (AIMP_PLAYLIST_NOTIFY_CONTENT | AIMP_PLAYLIST_NOTIFY_FILEINFO |
                  AIMP_PLAYLIST_NOTIFY_NAME | AIMP_PLAYLIST_NOTIFY_PLAYBACKCURSOR |
                  AIMP_PLAYLIST_NOTIFY_PLAYINGSWITCHS | AIMP_PLAYLIST_NOTIFY_DEADSTATE)) != 0) {
      QueueSnapshotRefresh(true, true, false);
    }
  }

  void OnPlaylistRemoved() {
    QueueSnapshotRefresh(true, true, true);
  }

  void OnPlaylistManagerEvent() {
    QueueSnapshotRefresh(true, true, true);
  }

  void OnCoreMessage(LongWord message, int param1, void* param2, HRESULT* result) {
    (void)param2;
    (void)result;
    switch (message) {
      case AIMP_MSG_EVENT_PLAYER_STATE:
      case AIMP_MSG_EVENT_PLAYER_UPDATE_POSITION:
      case AIMP_MSG_EVENT_PLAYER_UPDATE_POSITION_HR:
      case AIMP_MSG_EVENT_STREAM_START:
      case AIMP_MSG_EVENT_STREAM_START_SUBTRACK:
      case AIMP_MSG_EVENT_STREAM_END:
      case AIMP_MSG_EVENT_PLAYING_FILE_INFO: {
        const bool track_change =
            message == AIMP_MSG_EVENT_STREAM_START ||
            message == AIMP_MSG_EVENT_STREAM_START_SUBTRACK ||
            message == AIMP_MSG_EVENT_STREAM_END ||
            message == AIMP_MSG_EVENT_PLAYING_FILE_INFO ||
            message == AIMP_MSG_EVENT_PLAYER_STATE;
        QueueSnapshotRefresh(track_change, true, track_change);
        break;
      }
      case AIMP_MSG_EVENT_PROPERTY_VALUE:
        if (param1 == AIMP_MSG_PROPERTY_VOLUME || param1 == AIMP_MSG_PROPERTY_MUTE ||
            param1 == AIMP_MSG_PROPERTY_PLAYER_POSITION) {
          QueueSnapshotRefresh(false, true, false);
        }
        break;
      case AIMP_MSG_EVENT_TERMINATING:
        {
          std::scoped_lock lock(state_mutex_);
          SetGoodbyeReasonLocked(
              GoodbyeReason::AppClosing,
              L"AIMP is closing and the plugin is detaching from CherryPlayList.");
        }
        break;
      default:
        break;
    }
  }

 private:
  enum class GoodbyeReason {
    PluginShutdown,
    AppClosing,
    ProtocolMismatch,
    Restart,
    Unknown,
  };

  ~CherryPlayAimpPlugin() {
    Finalize();
  }

  static int GoodbyeReasonPriority(GoodbyeReason reason) {
    switch (reason) {
      case GoodbyeReason::AppClosing:
        return 40;
      case GoodbyeReason::ProtocolMismatch:
        return 30;
      case GoodbyeReason::Restart:
        return 20;
      case GoodbyeReason::PluginShutdown:
        return 10;
      case GoodbyeReason::Unknown:
      default:
        return 0;
    }
  }

  void SetGoodbyeReasonLocked(GoodbyeReason reason, std::wstring detail) {
    if (GoodbyeReasonPriority(reason) < GoodbyeReasonPriority(goodbye_reason_)) {
      return;
    }

    goodbye_reason_ = reason;
    goodbye_detail_ = std::move(detail);
  }

  void QueueSnapshotRefresh(bool refresh_playlist, bool refresh_playback, bool retrack_playlist) {
    std::scoped_lock lock(state_mutex_);
    playlist_refresh_requested_ = playlist_refresh_requested_ || refresh_playlist;
    playback_refresh_requested_ = playback_refresh_requested_ || refresh_playback;
    playlist_tracking_refresh_requested_ = playlist_tracking_refresh_requested_ || retrack_playlist;
    state_cv_.notify_all();
  }

  void StartSnapshotWorkerLocked() {
    snapshot_stop_requested_ = false;
    playlist_refresh_requested_ = true;
    playback_refresh_requested_ = true;
    playlist_tracking_refresh_requested_ = true;
    snapshot_thread_ = std::thread([this]() { SnapshotLoop(); });
  }

  void StopSnapshotWorker() {
    {
      std::scoped_lock lock(state_mutex_);
      snapshot_stop_requested_ = true;
      state_cv_.notify_all();
    }

    if (snapshot_thread_.joinable()) {
      snapshot_thread_.join();
    }
  }

  void SnapshotLoop() {
    for (;;) {
      bool retrack_playlist = false;
      bool refresh_playlist = false;
      bool refresh_playback = false;

      {
        std::unique_lock lock(state_mutex_);
        state_cv_.wait(lock, [this]() {
          return snapshot_stop_requested_ || playlist_tracking_refresh_requested_ ||
                 playlist_refresh_requested_ || playback_refresh_requested_;
        });

        if (snapshot_stop_requested_) {
          break;
        }

        retrack_playlist = playlist_tracking_refresh_requested_;
        refresh_playlist = playlist_refresh_requested_;
        refresh_playback = playback_refresh_requested_;
        playlist_tracking_refresh_requested_ = false;
        playlist_refresh_requested_ = false;
        playback_refresh_requested_ = false;
      }

      // Do not hold state_mutex_ while calling AIMP SDK to avoid deadlock:
      // AIMP may re-enter the plugin on the main thread (e.g. QueueSnapshotRefresh),
      // which would block on state_mutex_ while this thread is inside AIMP.
      // When IAIMPServiceThreads is available, run snapshot collection on the main thread
      // so playlist/player API calls are made from the correct thread.
      if (threads_service_) {
        ComPtr<IAIMPTask> task(
            new (std::nothrow) SnapshotCollectionTask(this, retrack_playlist, refresh_playlist,
                                                      refresh_playback));
        if (task) {
          if (SUCCEEDED(threads_service_->ExecuteInMainThread(task.Get(),
                                                              AIMP_SERVICE_THREADS_FLAGS_WAITFOR))) {
            // Task completed on main thread; snapshots updated.
          } else {
            RunSnapshotCollectionDirect(retrack_playlist, refresh_playlist, refresh_playback);
          }
        } else {
          RunSnapshotCollectionDirect(retrack_playlist, refresh_playlist, refresh_playback);
        }
      } else {
        RunSnapshotCollectionDirect(retrack_playlist, refresh_playlist, refresh_playback);
      }
    }
  }

  void RunSnapshotCollectionDirect(bool retrack_playlist, bool refresh_playlist,
                                    bool refresh_playback) {
    if (retrack_playlist) {
      TrackObservedPlaylistLocked();
    }
    if (refresh_playlist) {
      RefreshPlaylistSnapshotLocked();
    }
    if (refresh_playback) {
      RefreshPlaybackSnapshotLocked();
    }
  }

  void TrackObservedPlaylistLocked() {
    if (snapshot_stop_requested_ || !playlist_manager_ || !playlist_listener_) {
      return;
    }

    // Resolve which playlist to observe. Try in order:
    // 1) Playlist of the currently playing item (works when playback is active; may work when
    //    GetPlayingPlaylist/GetActivePlaylist return null from this thread).
    // 2) GetPlayingPlaylist() when player is not stopped.
    // 3) GetActivePlaylist() as fallback.
    ComPtr<IAIMPPlaylist> candidate;
    if (player_ && player_->GetState() != AIMP_PLAYER_STATE_STOPPED) {
      IAIMPPlaylistItem* raw_item = nullptr;
      if (SUCCEEDED(player_->GetPlaylistItem(&raw_item)) && raw_item) {
        ComPtr<IAIMPPlaylistItem> item(raw_item);
        IAIMPPlaylist* raw_playlist = nullptr;
        if (SUCCEEDED(item->GetValueAsObject(AIMP_PLAYLISTITEM_PROPID_PLAYLIST, IID_IAIMPPlaylist,
                                             reinterpret_cast<void**>(&raw_playlist))) &&
            raw_playlist) {
          candidate.Reset(raw_playlist);
        }
      }
    }
    if (!candidate && player_ && player_->GetState() != AIMP_PLAYER_STATE_STOPPED) {
      IAIMPPlaylist* playing_playlist = nullptr;
      if (SUCCEEDED(playlist_manager_->GetPlayingPlaylist(&playing_playlist)) && playing_playlist) {
        candidate.Reset(playing_playlist);
      }
    }
    if (!candidate) {
      IAIMPPlaylist* active_playlist = nullptr;
      if (SUCCEEDED(playlist_manager_->GetActivePlaylist(&active_playlist)) && active_playlist) {
        candidate.Reset(active_playlist);
      }
    }

    std::scoped_lock lock(state_mutex_);
    if (candidate.Get() == observed_playlist_.Get()) {
      return;
    }
    if (observed_playlist_) {
      observed_playlist_->ListenerRemove(playlist_listener_.Get());
      observed_playlist_.Reset();
    }
    observed_playlist_ = std::move(candidate);
    if (observed_playlist_) {
      observed_playlist_->ListenerAdd(playlist_listener_.Get());
    }
  }

  void DetachObservedPlaylistLocked() {
    if (observed_playlist_ && playlist_listener_) {
      observed_playlist_->ListenerRemove(playlist_listener_.Get());
    }
    observed_playlist_.Reset();
  }

  TrackReference BuildTrackReferenceFromItemLocked(IAIMPPlaylistItem* item) const {
    if (!item) {
      return MakeTrackReference(L"", L"", L"Unknown Track", 0);
    }

    ComPtr<IAIMPFileInfo> file_info;
    {
      IAIMPFileInfo* raw_file_info = nullptr;
      if (SUCCEEDED(item->GetValueAsObject(AIMP_PLAYLISTITEM_PROPID_FILEINFO, IID_IAIMPFileInfo,
                                           reinterpret_cast<void**>(&raw_file_info))) &&
          raw_file_info) {
        file_info.Reset(raw_file_info);
      }
    }

    std::wstring native_track_id =
        TrimOrFallback(ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_KEY), L"");
    std::wstring file_path = ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_FILENAME);
    if (file_path.empty()) {
      file_path = ReadStringProperty(item, AIMP_PLAYLISTITEM_PROPID_FILENAME);
    }

    std::wstring title = ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_TITLE);
    if (title.empty()) {
      title = ExtractTitleFromPath(file_path);
    }

    std::optional<int64_t> duration_ms = ReadDurationMs(file_info.Get(), AIMP_FILEINFO_PROPID_DURATION);
    if (!duration_ms.has_value() && native_track_id.empty() && file_path.empty()) {
      duration_ms = 0;
    }

    return MakeTrackReference(std::move(native_track_id), std::move(file_path), std::move(title),
                              duration_ms);
  }

  PlaylistTrack BuildPlaylistTrackLocked(IAIMPPlaylistItem* item, int position_in_queue,
                                         bool is_active) const {
    PlaylistTrack track;
    track.reference = BuildTrackReferenceFromItemLocked(item);

    ComPtr<IAIMPFileInfo> file_info;
    {
      IAIMPFileInfo* raw_file_info = nullptr;
      if (item &&
          SUCCEEDED(item->GetValueAsObject(AIMP_PLAYLISTITEM_PROPID_FILEINFO, IID_IAIMPFileInfo,
                                           reinterpret_cast<void**>(&raw_file_info))) &&
          raw_file_info) {
        file_info.Reset(raw_file_info);
      }
    }

    const std::wstring fallback_title =
        track.reference.title ? *track.reference.title
                              : (track.reference.file_path ? ExtractTitleFromPath(*track.reference.file_path)
                                                           : L"Unknown Track");
    track.title = TrimOrFallback(ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_TITLE),
                                 fallback_title);

    const std::wstring artist = ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_ARTIST);
    if (!artist.empty()) {
      track.artist = artist;
    }

    const std::wstring album = ReadStringProperty(file_info.Get(), AIMP_FILEINFO_PROPID_ALBUM);
    if (!album.empty()) {
      track.album = album;
    }

    track.duration_ms = ReadDurationMs(file_info.Get(), AIMP_FILEINFO_PROPID_DURATION);
    if (!track.duration_ms && track.reference.duration_ms) {
      track.duration_ms = track.reference.duration_ms;
    }

    track.position_in_queue = position_in_queue;
    track.is_active = is_active;
    return track;
  }

  std::optional<int> ResolveActivePlaylistIndexLocked(IAIMPPropertyList* playlist_properties) const {
    const auto focus_index =
        ReadIntProperty(playlist_properties, AIMP_PLAYLIST_PROPID_FOCUSINDEX);
    if (focus_index.has_value() && *focus_index >= 0) {
      return focus_index;
    }

    const auto playback_cursor =
        ReadIntProperty(playlist_properties, AIMP_PLAYLIST_PROPID_PLAYBACKCURSOR);
    if (playback_cursor.has_value() && *playback_cursor >= 0) {
      return playback_cursor;
    }

    const auto playing_index =
        ReadIntProperty(playlist_properties, AIMP_PLAYLIST_PROPID_PLAYINGINDEX);
    if (playing_index.has_value() && *playing_index >= 0) {
      return playing_index;
    }

    return std::nullopt;
  }

  bool PlaylistContainsTrackReferenceLocked(const TrackReference& reference) const {
    return std::any_of(playlist_snapshot_.data.tracks.begin(), playlist_snapshot_.data.tracks.end(),
                       [&reference](const PlaylistTrack& track) {
                         return track.reference == reference;
                       });
  }

  void RefreshPlaylistSnapshotLocked() {
    if (snapshot_stop_requested_) {
      return;
    }
    ComPtr<IAIMPPlaylist> observed;
    {
      std::scoped_lock lock(state_mutex_);
      observed = observed_playlist_;
    }

    PlaylistStateData next_state;
    if (observed) {
      ComPtr<IAIMPPropertyList> playlist_properties;
      {
        ComPtr<IAIMPPlaylistProperties> as_playlist_props =
            QueryComInterface<IAIMPPlaylistProperties>(observed.Get(), IID_IAIMPPlaylistProperties);
        if (as_playlist_props) {
          playlist_properties.Reset(
              static_cast<IAIMPPropertyList*>(as_playlist_props.Detach()));
        }
      }
      if (!playlist_properties) {
        playlist_properties =
            QueryComInterface<IAIMPPropertyList>(observed.Get(), IID_IAIMPPropertyList);
      }
      std::wstring playlist_id =
          ReadStringProperty(playlist_properties.Get(), AIMP_PLAYLIST_PROPID_ID);
      std::wstring playlist_name =
          ReadStringProperty(playlist_properties.Get(), AIMP_PLAYLIST_PROPID_NAME);

      next_state.playlist_id =
          TrimOrFallback(std::move(playlist_id), TrimOrFallback(playlist_name, L"active-playlist"));
      next_state.playlist_name =
          TrimOrFallback(std::move(playlist_name), L"Active Playlist");

      const auto active_index = ResolveActivePlaylistIndexLocked(playlist_properties.Get());

      int item_count = observed->GetItemCount();
      const int group_count = observed->GetGroupCount();

      // When grouping is on, GetItemCount() can return 0; iterate groups and their items.
      if (item_count == 0 && group_count > 0) {
        int position_in_queue = 0;
        for (int g = 0; g < group_count && !snapshot_stop_requested_; ++g) {
          IAIMPPlaylistGroup* raw_group = nullptr;
          if (FAILED(observed->GetGroup(g, IID_IAIMPPlaylistGroup,
                                        reinterpret_cast<void**>(&raw_group))) ||
              !raw_group) {
            continue;
          }
          ComPtr<IAIMPPlaylistGroup> group(raw_group);
          const int n = group->GetItemCount();
          for (int i = 0; i < n && !snapshot_stop_requested_; ++i) {
            IAIMPPlaylistItem* raw_item = nullptr;
            if (FAILED(group->GetItem(i, IID_IAIMPPlaylistItem,
                                     reinterpret_cast<void**>(&raw_item))) ||
                !raw_item) {
              continue;
            }
            ComPtr<IAIMPPlaylistItem> item(raw_item);
            const bool is_active = active_index.has_value() && *active_index == position_in_queue;
            auto track = BuildPlaylistTrackLocked(item.Get(), position_in_queue, is_active);
            if (is_active) {
              next_state.active_track = track.reference;
            }
            next_state.tracks.push_back(std::move(track));
            ++position_in_queue;
          }
        }
      } else {
        next_state.tracks.reserve(item_count > 0 ? static_cast<size_t>(item_count) : 0U);
        for (int index = 0; index < item_count; ++index) {
          if (snapshot_stop_requested_) {
            break;
          }
          IAIMPPlaylistItem* raw_item = nullptr;
          if (FAILED(observed->GetItem(index, IID_IAIMPPlaylistItem,
                                       reinterpret_cast<void**>(&raw_item))) ||
              !raw_item) {
            continue;
          }

          ComPtr<IAIMPPlaylistItem> item(raw_item);
          const bool is_active = active_index.has_value() && *active_index == index;
          auto track = BuildPlaylistTrackLocked(item.Get(), index, is_active);
          if (is_active) {
            next_state.active_track = track.reference;
          }
          next_state.tracks.push_back(std::move(track));
        }
      }
    } else {
      next_state.playlist_id = L"active-playlist";
      next_state.playlist_name = L"Active Playlist";
    }

    {
      std::scoped_lock lock(state_mutex_);
      if (next_state != playlist_snapshot_.data) {
        playlist_snapshot_.data = std::move(next_state);
        ++playlist_snapshot_.revision;
        playlist_dirty_ = true;
        state_cv_.notify_all();
      }
    }
  }

  void RefreshPlaybackSnapshotLocked() {
    if (snapshot_stop_requested_) {
      return;
    }
    PlaylistStateData playlist_copy;
    {
      std::scoped_lock lock(state_mutex_);
      playlist_copy = playlist_snapshot_.data;
    }

    PlaybackStateData next_state;
    if (player_) {
      switch (player_->GetState()) {
        case AIMP_PLAYER_STATE_PLAYING:
          next_state.status = L"playing";
          break;
        case AIMP_PLAYER_STATE_PAUSED:
          next_state.status = L"paused";
          break;
        case AIMP_PLAYER_STATE_STOPPED:
        default:
          next_state.status = L"stopped";
          break;
      }

      double position_seconds = 0.0;
      if (SUCCEEDED(player_->GetPosition(&position_seconds)) && position_seconds >= 0.0) {
        next_state.position_ms = static_cast<int64_t>(position_seconds * 1000.0 + 0.5);
      }

      double duration_seconds = 0.0;
      if (SUCCEEDED(player_->GetDuration(&duration_seconds)) && duration_seconds >= 0.0) {
        next_state.duration_ms = static_cast<int64_t>(duration_seconds * 1000.0 + 0.5);
      }

      float volume = 0.0F;
      if (SUCCEEDED(player_->GetVolume(&volume))) {
        const int percent = static_cast<int>(volume * 100.0F + 0.5F);
        next_state.volume_percent = std::clamp(percent, 0, 100);
      }

      BOOL is_muted = FALSE;
      if (SUCCEEDED(player_->GetMute(&is_muted))) {
        next_state.is_muted = is_muted == TRUE;
      }

      IAIMPPlaylistItem* raw_current_item = nullptr;
      if (SUCCEEDED(player_->GetPlaylistItem(&raw_current_item)) && raw_current_item) {
        ComPtr<IAIMPPlaylistItem> current_item(raw_current_item);
        next_state.current_track = BuildTrackReferenceFromItemLocked(current_item.Get());
        // Do not clear current_track when it is not in the playlist snapshot; desktop
        // (CherryPlayList) enforces consistency via getAimpPlaybackPlaylistConsistencyError /
        // reconcilePlaybackSnapshotWithPlaylist.
      }
    }

    {
      std::scoped_lock lock(state_mutex_);
      if (next_state != playback_snapshot_.data) {
        playback_snapshot_.data = std::move(next_state);
        ++playback_snapshot_.revision;
        playback_dirty_ = true;
        state_cv_.notify_all();
      }
    }
  }

  std::string BuildEnvelopePrefix(const char* type, uint64_t sequence,
                                  const std::wstring& sent_at) const {
    std::ostringstream json;
    json << '{';
    json << "\"type\":\"" << type << "\",";
    json << "\"protocolVersion\":" << QuoteJson(kProtocolVersion) << ',';
    json << "\"sequence\":" << sequence << ',';
    json << "\"messageId\":" << QuoteJson(instance_id_ + L"-" + std::to_wstring(sequence)) << ',';
    json << "\"sentAt\":" << QuoteJson(sent_at) << ',';
    json << "\"payload\":";
    return json.str();
  }

  std::string BuildHelloMessage(uint64_t sequence, const std::wstring& sent_at) const {
    std::ostringstream json;
    json << BuildEnvelopePrefix("hello", sequence, sent_at);
    json << '{';
    json << "\"pluginName\":" << QuoteJson(kPluginName) << ',';
    json << "\"pluginVersion\":" << QuoteJson(kPluginVersion) << ',';
    json << "\"aimpVersion\":" << QuoteJson(aimp_version_) << ',';
    json << "\"architecture\":" << QuoteJson(kArchitecture) << ',';
    json << "\"platform\":" << QuoteJson(kPlatform) << ',';
    json << "\"instanceId\":" << QuoteJson(instance_id_);
    json << "}}";
    return json.str();
  }

  std::string BuildPlaylistSnapshotMessage(uint64_t sequence, const std::wstring& sent_at,
                                           const PlaylistSnapshot& snapshot) const {
    std::ostringstream json;
    json << BuildEnvelopePrefix("playlistSnapshot", sequence, sent_at);
    json << '{';
    json << "\"playlistId\":" << QuoteJson(snapshot.data.playlist_id) << ',';
    json << "\"playlistName\":" << QuoteJson(snapshot.data.playlist_name) << ',';
    json << "\"revision\":" << snapshot.revision << ',';

    if (snapshot.data.active_track) {
      json << "\"activeTrack\":" << SerializeTrackReference(*snapshot.data.active_track) << ',';
    } else {
      json << "\"activeTrack\":null,";
    }
    json << "\"activeTrackKey\":";
    if (snapshot.data.active_track) {
      json << QuoteJson(BuildCanonicalTrackKey(*snapshot.data.active_track));
    } else {
      json << "null";
    }
    json << ',';

    json << "\"tracks\":[";
    for (size_t index = 0; index < snapshot.data.tracks.size(); ++index) {
      const PlaylistTrack& track = snapshot.data.tracks[index];
      if (index > 0) {
        json << ',';
      }

      json << '{';
      bool first = true;
      auto write_field = [&](const char* name, const std::wstring& value) {
        if (!first) {
          json << ',';
        }
        first = false;
        json << '"' << name << "\":" << QuoteJson(value);
      };
      auto write_int = [&](const char* name, int64_t value) {
        if (!first) {
          json << ',';
        }
        first = false;
        json << '"' << name << "\":" << value;
      };

      write_field("trackKey", BuildCanonicalTrackKey(track.reference));
      if (track.reference.native_track_id) {
        write_field("nativeTrackId", *track.reference.native_track_id);
      }
      if (track.reference.file_path) {
        write_field("filePath", *track.reference.file_path);
      }

      write_field("title", track.title);

      if (track.artist) {
        write_field("artist", *track.artist);
      }
      if (track.album) {
        write_field("album", *track.album);
      }
      if (track.duration_ms) {
        write_int("durationMs", *track.duration_ms);
      } else if (!track.reference.native_track_id && !track.reference.file_path) {
        write_int("durationMs", track.reference.duration_ms.value_or(0));
      }

      write_int("positionInQueue", track.position_in_queue);

      if (!first) {
        json << ',';
      }
      json << "\"isActive\":" << (track.is_active ? "true" : "false");
      json << '}';
    }
    json << "]";
    json << "}}";
    return json.str();
  }

  std::string BuildPlaybackSnapshotMessage(uint64_t sequence, const std::wstring& sent_at,
                                           const PlaybackSnapshot& snapshot) const {
    std::ostringstream json;
    json << BuildEnvelopePrefix("playbackSnapshot", sequence, sent_at);
    json << '{';
    json << "\"revision\":" << snapshot.revision << ',';
    json << "\"status\":" << QuoteJson(snapshot.data.status) << ',';
    if (snapshot.data.current_track) {
      json << "\"currentTrack\":" << SerializeTrackReference(*snapshot.data.current_track) << ',';
    } else {
      json << "\"currentTrack\":null,";
    }
    json << "\"currentTrackKey\":";
    if (snapshot.data.current_track) {
      json << QuoteJson(BuildCanonicalTrackKey(*snapshot.data.current_track));
    } else {
      json << "null";
    }
    json << ',';
    json << "\"positionMs\":" << snapshot.data.position_ms << ',';
    if (snapshot.data.duration_ms) {
      json << "\"durationMs\":" << *snapshot.data.duration_ms << ',';
    } else {
      json << "\"durationMs\":null,";
    }
    if (snapshot.data.volume_percent) {
      json << "\"volumePercent\":" << *snapshot.data.volume_percent << ',';
    }
    json << "\"isMuted\":" << (snapshot.data.is_muted ? "true" : "false");
    json << "}}";
    return json.str();
  }

  std::string BuildHeartbeatMessage(uint64_t sequence, const std::wstring& sent_at,
                                    const PlaylistSnapshot& playlist_snapshot,
                                    const PlaybackSnapshot& playback_snapshot,
                                    std::chrono::steady_clock::time_point connected_at) const {
    const auto uptime =
        std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() -
                                                              connected_at)
            .count();

    std::ostringstream json;
    json << BuildEnvelopePrefix("heartbeat", sequence, sent_at);
    json << '{';
    json << "\"connectionUptimeMs\":" << uptime << ',';
    json << "\"lastPlaylistRevision\":" << playlist_snapshot.revision << ',';
    json << "\"lastPlaybackRevision\":" << playback_snapshot.revision;
    json << "}}";
    return json.str();
  }

  std::string BuildGoodbyeMessage(uint64_t sequence, const std::wstring& sent_at,
                                  GoodbyeReason reason, const std::wstring& detail) const {
    std::wstring reason_text = L"unknown";
    switch (reason) {
      case GoodbyeReason::PluginShutdown:
        reason_text = L"pluginShutdown";
        break;
      case GoodbyeReason::AppClosing:
        reason_text = L"appClosing";
        break;
      case GoodbyeReason::ProtocolMismatch:
        reason_text = L"protocolMismatch";
        break;
      case GoodbyeReason::Restart:
        reason_text = L"restart";
        break;
      case GoodbyeReason::Unknown:
      default:
        reason_text = L"unknown";
        break;
    }

    std::ostringstream json;
    json << BuildEnvelopePrefix("goodbye", sequence, sent_at);
    json << '{';
    json << "\"reason\":" << QuoteJson(reason_text);
    if (!detail.empty()) {
      json << ",\"detail\":" << QuoteJson(detail);
    }
    json << "}}";
    return json.str();
  }

  bool WriteLineToPipe(HANDLE pipe_handle, const std::string& line) const {
    std::string payload = line;
    payload.push_back('\n');

    const char* current = payload.data();
    size_t remaining = payload.size();
    while (remaining > 0) {
      DWORD written = 0;
      const auto chunk = static_cast<DWORD>(std::min<size_t>(remaining, 64 * 1024));
      if (!WriteFile(pipe_handle, current, chunk, &written, nullptr)) {
        return false;
      }
      if (written == 0) {
        return false;
      }
      current += written;
      remaining -= written;
    }
    return true;
  }

  bool ReadLineFromPipe(HANDLE pipe_handle, std::chrono::milliseconds timeout,
                        std::string* line) const {
    if (!line) {
      return false;
    }

    line->clear();
    std::string buffer;
    buffer.reserve(1024);
    const auto deadline = std::chrono::steady_clock::now() + timeout;

    while (std::chrono::steady_clock::now() < deadline) {
      DWORD bytes_available = 0;
      if (!PeekNamedPipe(pipe_handle, nullptr, 0, nullptr, &bytes_available, nullptr)) {
        return false;
      }

      if (bytes_available == 0) {
        Sleep(static_cast<DWORD>(kPipeReadPollInterval.count()));
        continue;
      }

      std::string chunk(static_cast<size_t>(bytes_available), '\0');
      DWORD bytes_read = 0;
      if (!ReadFile(pipe_handle, chunk.data(), bytes_available, &bytes_read, nullptr) ||
          bytes_read == 0) {
        return false;
      }

      chunk.resize(bytes_read);
      buffer.append(chunk);

      const size_t newline_pos = buffer.find('\n');
      if (newline_pos != std::string::npos) {
        *line = buffer.substr(0, newline_pos);
        if (!line->empty() && line->back() == '\r') {
          line->pop_back();
        }
        return true;
      }
    }

    return false;
  }

  HelloAckResult ReadHelloAck(HANDLE pipe_handle) const {
    std::string line;
    if (!ReadLineFromPipe(pipe_handle, kHandshakeResponseTimeout, &line)) {
      return {};
    }

    HelloAckResult result;
    const auto type = ExtractJsonStringField(line, "type");
    const auto accepted = ExtractJsonBoolField(line, "accepted");
    const auto protocol_version = ExtractJsonStringField(line, "serverProtocolVersion");
    const auto envelope_protocol = ExtractJsonStringField(line, "protocolVersion");
    const auto error_code = ExtractJsonStringField(line, "errorCode");
    const auto detail = ExtractJsonStringField(line, "detail");

    if (protocol_version) {
      result.server_protocol_version.assign(protocol_version->begin(), protocol_version->end());
    } else if (envelope_protocol) {
      result.server_protocol_version.assign(envelope_protocol->begin(), envelope_protocol->end());
    }
    if (error_code) {
      result.error_code.assign(error_code->begin(), error_code->end());
    }
    if (detail) {
      result.detail.assign(detail->begin(), detail->end());
    }

    if (!type || *type != "helloAck" || !accepted.has_value()) {
      result.decision = HelloAckDecision::Rejected;
      if (result.detail.empty()) {
        result.detail = L"CherryPlayList returned an invalid handshake response.";
      }
      return result;
    }

    if (*accepted) {
      result.decision = HelloAckDecision::Accepted;
      return result;
    }

    result.decision = (result.error_code == L"unsupportedProtocolVersion" ||
                       (!result.server_protocol_version.empty() &&
                        result.server_protocol_version != kProtocolVersion))
                          ? HelloAckDecision::ProtocolMismatch
                          : HelloAckDecision::Rejected;
    if (result.detail.empty()) {
      result.detail = L"CherryPlayList rejected the AIMP hello handshake.";
    }
    return result;
  }

  void TransportLoop() {
    // Runs in a dedicated thread; never blocks the main thread or AIMP UI.
    // When CherryPlayList is not running, CreateFileW(OPEN_EXISTING) fails immediately
    // (ERROR_FILE_NOT_FOUND); we then wait kReconnectDelay and retry, so AIMP starts normally.
    ScopedHandle pipe_handle;
    bool session_started = false;
    auto connected_at = std::chrono::steady_clock::now();
    auto next_heartbeat = connected_at + kHeartbeatInterval;

    for (;;) {
      PlaylistSnapshot playlist_snapshot_copy;
      PlaybackSnapshot playback_snapshot_copy;
      bool send_playlist = false;
      bool send_playback = false;
      GoodbyeReason goodbye_reason = GoodbyeReason::Unknown;
      std::wstring goodbye_detail;
      bool stop_requested = false;

      {
        std::unique_lock lock(state_mutex_);
        if (!session_started) {
          stop_requested = transport_stop_requested_;
        } else {
          const auto now = std::chrono::steady_clock::now();
          auto deadline = next_heartbeat;
          if (next_playback_send_allowed_at_ > now && next_playback_send_allowed_at_ < deadline) {
            deadline = next_playback_send_allowed_at_;
          }
          state_cv_.wait_until(lock, deadline, [this]() {
            return transport_stop_requested_ || playlist_dirty_ || playback_dirty_;
          });
          stop_requested = transport_stop_requested_;
        }

        if (stop_requested) {
          goodbye_reason = goodbye_reason_;
          goodbye_detail = goodbye_detail_;
        } else {
          playlist_snapshot_copy = playlist_snapshot_;
          playback_snapshot_copy = playback_snapshot_;
          send_playlist = playlist_dirty_;
          send_playback = playback_dirty_;
          playlist_dirty_ = false;
          playback_dirty_ = false;
        }
      }

      if (stop_requested) {
        // Skip writing goodbye on plugin shutdown to avoid blocking on pipe (process exiting).
        if (goodbye_reason != GoodbyeReason::PluginShutdown && session_started &&
            pipe_handle.IsValid()) {
          const std::wstring sent_at = GetIsoUtcNow();
          const uint64_t sequence = ++sequence_;
          const auto goodbye_message =
              BuildGoodbyeMessage(sequence, sent_at, goodbye_reason, goodbye_detail);
          WriteLineToPipe(pipe_handle.Get(), goodbye_message);
        }
        break;
      }

      if (!session_started) {
        ScopedHandle next_pipe(
            CreateFileW(kPipeName, GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
                        FILE_ATTRIBUTE_NORMAL, nullptr));

        if (!next_pipe.IsValid()) {
          const DWORD error = GetLastError();
          if (error == ERROR_PIPE_BUSY) {
            WaitNamedPipeW(kPipeName, static_cast<DWORD>(kReconnectDelay.count()));
          } else {
            std::unique_lock lock(state_mutex_);
            state_cv_.wait_for(lock, kReconnectDelay, [this]() { return transport_stop_requested_; });
          }
          continue;
        }

        pipe_handle = std::move(next_pipe);
        connected_at = std::chrono::steady_clock::now();
        next_heartbeat = connected_at + kHeartbeatInterval;
        sequence_ = 0;

        const std::wstring sent_at = GetIsoUtcNow();
        if (!WriteLineToPipe(pipe_handle.Get(), BuildHelloMessage(++sequence_, sent_at))) {
          pipe_handle.Reset();
          continue;
        }

        const HelloAckResult hello_ack = ReadHelloAck(pipe_handle.Get());
        if (hello_ack.decision == HelloAckDecision::ProtocolMismatch) {
          const std::wstring server_version =
              hello_ack.server_protocol_version.empty() ? L"unknown" : hello_ack.server_protocol_version;
          LogDiagnostic(L"CherryPlayList rejected the AIMP protocol version. Plugin=" +
                        std::wstring(kProtocolVersion) + L", server=" + server_version + L". " +
                        hello_ack.detail);
          pipe_handle.Reset();
          std::unique_lock lock(state_mutex_);
          SetGoodbyeReasonLocked(
              GoodbyeReason::ProtocolMismatch,
              hello_ack.detail.empty()
                  ? L"CherryPlayList rejected the plugin protocol version during helloAck."
                  : hello_ack.detail);
          state_cv_.wait_for(lock, kProtocolMismatchReconnectBackoff,
                             [this]() { return transport_stop_requested_; });
          continue;
        }

        if (hello_ack.decision == HelloAckDecision::Rejected) {
          LogDiagnostic(hello_ack.detail.empty()
                            ? L"CherryPlayList rejected the AIMP hello handshake."
                            : hello_ack.detail);
          pipe_handle.Reset();
          std::unique_lock lock(state_mutex_);
          state_cv_.wait_for(lock, kReconnectDelay, [this]() { return transport_stop_requested_; });
          continue;
        }

        {
          std::scoped_lock lock(state_mutex_);
          goodbye_reason_ = GoodbyeReason::Unknown;
          goodbye_detail_.clear();
          playlist_dirty_ = true;
          playback_dirty_ = true;
          playlist_refresh_requested_ = true;
          playback_refresh_requested_ = true;
          playlist_tracking_refresh_requested_ = true;
          state_cv_.notify_all();
        }
        // Give SnapshotLoop time to refresh so the first send has current playlist/playback.
        // AIMP may not have active playlist ready yet at first wake; run refresh twice so we
        // get a chance after AIMP has restored UI / active playlist.
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
        {
          std::scoped_lock lock(state_mutex_);
          playlist_refresh_requested_ = true;
          playback_refresh_requested_ = true;
          playlist_tracking_refresh_requested_ = true;
          state_cv_.notify_all();
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
        session_started = true;
        continue;
      }

      bool write_failed = false;
      if (send_playlist) {
        write_failed = !WriteLineToPipe(
            pipe_handle.Get(),
            BuildPlaylistSnapshotMessage(++sequence_, GetIsoUtcNow(), playlist_snapshot_copy));
      }

      if (send_playback) {
        const auto now = std::chrono::steady_clock::now();
        if (now - last_playback_send_time_ < kPlaybackSnapshotMinInterval) {
          send_playback = false;
          {
            std::scoped_lock lock(state_mutex_);
            playback_dirty_ = true;
            next_playback_send_allowed_at_ = now + kPlaybackSnapshotMinInterval;
          }
        } else {
          last_playback_send_time_ = now;
          next_playback_send_allowed_at_ = {};
          if (!write_failed) {
            write_failed = !WriteLineToPipe(
                pipe_handle.Get(),
                BuildPlaybackSnapshotMessage(++sequence_, GetIsoUtcNow(), playback_snapshot_copy));
          }
        }
      }

      const auto now = std::chrono::steady_clock::now();
      if (!write_failed && now >= next_heartbeat) {
        write_failed = !WriteLineToPipe(
            pipe_handle.Get(),
            BuildHeartbeatMessage(++sequence_, GetIsoUtcNow(), playlist_snapshot_copy,
                                  playback_snapshot_copy, connected_at));
        next_heartbeat = now + kHeartbeatInterval;
      }

      if (write_failed) {
        pipe_handle.Reset();
        session_started = false;
        std::scoped_lock lock(state_mutex_);
        playlist_dirty_ = true;
        playback_dirty_ = true;
      }
    }
  }

  void StopTransport(GoodbyeReason reason, const std::wstring& detail) {
    {
      std::scoped_lock lock(state_mutex_);
      SetGoodbyeReasonLocked(reason, detail);
      if (transport_stop_requested_) {
        return;
      }
      transport_stop_requested_ = true;
      state_cv_.notify_all();
    }

    if (transport_thread_.joinable()) {
      transport_thread_.join();
    }
  }

  std::atomic_ulong ref_count_{1};
  IAIMPCore* core_ = nullptr;
  ComPtr<IAIMPServicePlaylistManager> playlist_manager_;
  ComPtr<IAIMPServicePlayer> player_;
  ComPtr<IAIMPServiceMessageDispatcher> message_dispatcher_;
  ComPtr<IAIMPServiceThreads> threads_service_;
  ComPtr<IAIMPPlaylist> observed_playlist_;
  ComPtr<PluginPlaylistListener> playlist_listener_;
  ComPtr<PluginPlaylistManagerListener> playlist_manager_listener_;
  ComPtr<PluginMessageHook> message_hook_;

  std::mutex state_mutex_;
  std::condition_variable state_cv_;
  PlaylistSnapshot playlist_snapshot_;
  PlaybackSnapshot playback_snapshot_;
  bool playlist_dirty_ = true;
  bool playback_dirty_ = true;
  bool playlist_refresh_requested_ = true;
  bool playback_refresh_requested_ = true;
  bool playlist_tracking_refresh_requested_ = true;
  bool snapshot_stop_requested_ = false;
  bool transport_stop_requested_ = false;
  bool initialized_ = false;
  std::thread snapshot_thread_;
  std::thread transport_thread_;
  uint64_t sequence_ = 0;
  std::chrono::steady_clock::time_point last_playback_send_time_{};
  std::chrono::steady_clock::time_point next_playback_send_allowed_at_{};
  GoodbyeReason goodbye_reason_ = GoodbyeReason::Unknown;
  std::wstring goodbye_detail_;
  std::wstring instance_id_;
  std::wstring aimp_version_ = L"unknown";
};

SnapshotCollectionTask::SnapshotCollectionTask(CherryPlayAimpPlugin* plugin, bool retrack_playlist,
                                               bool refresh_playlist, bool refresh_playback)
    : plugin_(plugin),
      retrack_playlist_(retrack_playlist),
      refresh_playlist_(refresh_playlist),
      refresh_playback_(refresh_playback) {}

HRESULT SnapshotCollectionTask::QueryInterface(REFIID iid, void** object) {
  if (!object) {
    return E_POINTER;
  }
  if (iid == IID_IUnknown || iid == IID_IAIMPTask) {
    *object = static_cast<IAIMPTask*>(this);
    AddRef();
    return S_OK;
  }
  *object = nullptr;
  return E_NOINTERFACE;
}

ULONG SnapshotCollectionTask::AddRef() {
  return static_cast<ULONG>(++ref_count_);
}

ULONG SnapshotCollectionTask::Release() {
  const ULONG value = static_cast<ULONG>(--ref_count_);
  if (value == 0) {
    delete this;
  }
  return value;
}

void SnapshotCollectionTask::Execute(IAIMPTaskOwner* owner) {
  (void)owner;
  if (!plugin_) {
    return;
  }
  if (retrack_playlist_) {
    plugin_->TrackObservedPlaylistLocked();
  }
  if (refresh_playlist_) {
    plugin_->RefreshPlaylistSnapshotLocked();
  }
  if (refresh_playback_) {
    plugin_->RefreshPlaybackSnapshotLocked();
  }
}

HRESULT PluginPlaylistListener::QueryInterface(REFIID iid, void** object) {
  if (!object) {
    return E_POINTER;
  }

  if (iid == IID_IUnknown || iid == IID_IAIMPPlaylistListener) {
    *object = static_cast<IAIMPPlaylistListener*>(this);
    AddRef();
    return S_OK;
  }

  *object = nullptr;
  return E_NOINTERFACE;
}

void PluginPlaylistListener::Activated() {
  if (owner_) {
    owner_->OnPlaylistActivated();
  }
}

void PluginPlaylistListener::Changed(LongWord flags) {
  if (owner_) {
    owner_->OnPlaylistChanged(flags);
  }
}

void PluginPlaylistListener::Removed() {
  if (owner_) {
    owner_->OnPlaylistRemoved();
  }
}

HRESULT PluginPlaylistManagerListener::QueryInterface(REFIID iid, void** object) {
  if (!object) {
    return E_POINTER;
  }

  if (iid == IID_IUnknown || iid == IID_IAIMPExtensionPlaylistManagerListener) {
    *object = static_cast<IAIMPExtensionPlaylistManagerListener*>(this);
    AddRef();
    return S_OK;
  }

  *object = nullptr;
  return E_NOINTERFACE;
}

void PluginPlaylistManagerListener::PlaylistActivated(IAIMPPlaylist* playlist) {
  (void)playlist;
  if (owner_) {
    owner_->OnPlaylistManagerEvent();
  }
}

void PluginPlaylistManagerListener::PlaylistAdded(IAIMPPlaylist* playlist) {
  (void)playlist;
  if (owner_) {
    owner_->OnPlaylistManagerEvent();
  }
}

void PluginPlaylistManagerListener::PlaylistRemoved(IAIMPPlaylist* playlist) {
  (void)playlist;
  if (owner_) {
    owner_->OnPlaylistManagerEvent();
  }
}

HRESULT PluginMessageHook::QueryInterface(REFIID iid, void** object) {
  if (!object) {
    return E_POINTER;
  }

  if (iid == IID_IUnknown || iid == IID_IAIMPMessageHook) {
    *object = static_cast<IAIMPMessageHook*>(this);
    AddRef();
    return S_OK;
  }

  *object = nullptr;
  return E_NOINTERFACE;
}

void PluginMessageHook::CoreMessage(LongWord message, int param1, void* param2, HRESULT* result) {
  if (owner_) {
    owner_->OnCoreMessage(message, param1, param2, result);
  }
}

}  // namespace

extern "C" __declspec(dllexport) HRESULT WINAPI AIMPPluginGetHeader(IAIMPPlugin** header) {
  if (!header) {
    return E_POINTER;
  }

  *header = new (std::nothrow) CherryPlayAimpPlugin();
  if (!*header) {
    return E_OUTOFMEMORY;
  }

  return S_OK;
}
