# M12 source build: one pinned image for HTTP runtime and the separately invoked operator.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS frontend
WORKDIR /build/frontend
RUN npm install --global pnpm@9.15.9
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM eclipse-temurin:21-jdk-jammy@sha256:e0c60c487345d1dc9d0fc7b6f0496f3cc941e5132e09296cc17a6decc71b902b AS backend
WORKDIR /build/backend
COPY backend/ ./
COPY contracts/reference/ /build/contracts/reference/
COPY --from=frontend /build/frontend/dist /build/frontend/dist
RUN chmod 0755 gradlew && ./gradlew bootJar -PbundleFrontend=true --no-daemon
ADD https://storage.googleapis.com/cloudsql-ca-bundles/europe-west6.pem /build/cloud-sql.pem
RUN echo 'b4a6bf27a969fe04d242dd85b19578b09addc0aa5aad87f4be2409bab331788e  /build/cloud-sql.pem' | sha256sum --check -

FROM eclipse-temurin:21-jre-jammy@sha256:f04fb34e053148344e83317976114ec3f37e4b830ec8bdab5a2fe3cecd7d010b
WORKDIR /opt/ritomer
COPY --from=backend --chown=10001:10001 /build/backend/build/libs/*-SNAPSHOT.jar /opt/ritomer/app.jar
COPY --from=backend --chown=10001:10001 /build/cloud-sql.pem /opt/ritomer/certs/cloud-sql.pem
USER 10001:10001
EXPOSE 8080
# Job overrides command/args with the exact reviewed PropertiesLauncher invocation.
ENTRYPOINT ["java", "-jar", "/opt/ritomer/app.jar"]
