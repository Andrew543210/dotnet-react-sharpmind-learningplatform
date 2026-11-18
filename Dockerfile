FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:11.0.100 AS build
WORKDIR /source
COPY Directory.Build.props global.json ./
COPY src/SharpMind.Api/SharpMind.Api.csproj src/SharpMind.Api/packages.lock.json src/SharpMind.Api/
RUN dotnet restore src/SharpMind.Api --locked-mode
COPY src/SharpMind.Api/ src/SharpMind.Api/
RUN dotnet publish src/SharpMind.Api -c Release --no-restore -o /out
COPY --from=web /web/dist/ /out/wwwroot/

FROM mcr.microsoft.com/dotnet/aspnet:10.0.15 AS runtime
WORKDIR /app
COPY --from=build /out/ ./
RUN mkdir -p /app/data/media /app/data/keys && chown -R app:app /app/data
ENV ASPNETCORE_URLS=http://+:8080 \
    DataProtection__KeyPath=/app/data/keys \
    Media__RootPath=/app/data/media
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD ["dotnet", "SharpMind.Api.dll", "--healthcheck"]
ENTRYPOINT ["dotnet", "SharpMind.Api.dll"]
