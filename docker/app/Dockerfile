# 多階段建置 Java 應用並把四個技能帶入執行映像
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
COPY skills/law-powers/skills /app/skills
ENV LAWGRAPH_SKILLS_DIR=/app/skills
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
