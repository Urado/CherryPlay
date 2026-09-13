import * as signalR from '@microsoft/signalr';
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.API_URL || 'http://localhost:5000';
const SHORT = process.env.SHORT_CODE || 'cyber';
const CTRL = path.join(process.cwd(), '.smoke-organizer-ctrl');

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 't@t.ru', password: '123456' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const body = await res.json();
  return body.accessToken;
}

async function ensureReady(token, partyId) {
  const res = await fetch(`${API}/api/parties/${partyId}/lifecycle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ partyLifecycleState: 'ready' }),
  });
  if (!res.ok && res.status !== 409) {
    const t = await res.text();
    throw new Error(`lifecycle ${res.status} ${t}`);
  }
}

async function findParty(token) {
  const res = await fetch(`${API}/api/parties`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`parties ${res.status}`);
  const list = await res.json();
  const party = list.find((p) => p.shortCode === SHORT) || list[0];
  if (!party) throw new Error('no parties');
  return party;
}

async function firstTrackId(shortCode) {
  const res = await fetch(`${API}/api/parties/public/${shortCode}/playlist`);
  if (!res.ok) throw new Error(`playlist ${res.status}`);
  const pl = await res.json();
  for (const item of pl.items || []) {
    if (item.type === 'track') return { id: item.id, duration: item.duration || 180 };
    if (item.type === 'group') {
      for (const child of item.items || []) {
        if (child.type === 'track') return { id: child.id, duration: child.duration || 180 };
      }
    }
  }
  throw new Error('no tracks');
}

async function main() {
  const mode = process.argv[2] || 'start';
  const token = await login();
  const party = await findParty(token);
  await ensureReady(token, party.id);
  const track = await firstTrackId(party.shortCode);
  console.log(JSON.stringify({ partyId: party.id, shortCode: party.shortCode, trackId: track.id, mode }));

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API}/partyHub`, { accessTokenFactory: () => token })
    .withAutomaticReconnect([1000, 2000, 3000])
    .build();

  await connection.start();
  await connection.invoke('JoinPartyAsOrganizer', party.id, token);
  await connection.invoke('StartSession', party.id);

  const playback = {
    currentTrackId: track.id,
    status: 'playing',
    position: 12,
    duration: track.duration,
    volume: 0.8,
    mode: 'session',
    playedTrackIds: [],
    disabledTrackIds: [],
    disabledGroupIds: [],
    lastUpdatedAt: new Date().toISOString(),
  };
  await connection.invoke('UpdateFullState', party.id, playback);
  await connection.invoke('NotifyStateChanged', party.id);
  console.log('session live');

  if (mode === 'burst') {
    await new Promise((r) => setTimeout(r, 3000));
    await connection.stop();
    console.log('dropped');
    return;
  }

  fs.writeFileSync(CTRL, 'run');
  while (true) {
    await new Promise((r) => setTimeout(r, 500));
    if (!fs.existsSync(CTRL)) {
      try {
        await connection.invoke('EndSession', party.id);
      } catch {
      }
      await connection.stop();
      console.log('stopped');
      return;
    }
    const cmd = fs.readFileSync(CTRL, 'utf8').trim();
    if (cmd === 'drop') {
      await connection.stop();
      console.log('dropped (keep process for reconnect)');
      fs.writeFileSync(CTRL, 'dropped');
    } else if (cmd === 'reconnect') {
      if (connection.state !== signalR.HubConnectionState.Connected) {
        await connection.start();
      }
      await connection.invoke('JoinPartyAsOrganizer', party.id, token);
      await connection.invoke('StartSession', party.id);
      await connection.invoke('UpdateFullState', party.id, {
        ...playback,
        position: 40,
        lastUpdatedAt: new Date().toISOString(),
      });
      await connection.invoke('NotifyStateChanged', party.id);
      console.log('reconnected + republished');
      fs.writeFileSync(CTRL, 'run');
    } else if (cmd === 'stop') {
      try {
        await connection.invoke('EndSession', party.id);
      } catch {
      }
      await connection.stop();
      fs.unlinkSync(CTRL);
      console.log('stopped');
      return;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
