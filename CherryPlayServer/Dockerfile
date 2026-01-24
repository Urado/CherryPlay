FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["CherryPlayServer.csproj", "./"]
RUN dotnet restore "CherryPlayServer.csproj"
COPY . .
WORKDIR "/src"

RUN dotnet tool install -g dotnet-format 2>&1 || true
ENV PATH="${PATH}:/root/.dotnet/tools"

RUN if [ -f /root/.dotnet/tools/dotnet-format ]; then \
        dotnet format --verify-no-changes --verbosity diagnostic || (echo "ERROR: Code formatting check failed! Please run 'dotnet format' to fix formatting issues." && exit 1); \
    else \
        echo "Note: dotnet-format tool not installed, skipping format check"; \
    fi

RUN dotnet build "CherryPlayServer.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CherryPlayServer.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CherryPlayServer.dll"]
