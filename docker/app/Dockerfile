# 多階段建置 Java 應用並把四個技能帶入執行映像
# 基底映像改抓 AWS ECR Public 的官方鏡像（內容與 Docker Hub 同名映像相同）：
# Zeabur 專屬伺服器匿名拉 Docker Hub 會撞 429 Too Many Requests，且其鏡像站 dockerhub.zeabur.cloud 曾 DNS 解析失敗（2026-09-05 連三次建置失敗）
FROM public.ecr.aws/docker/library/maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package
FROM public.ecr.aws/docker/library/eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
COPY skills/law-powers/skills /app/skills
ENV LAWGRAPH_SKILLS_DIR=/app/skills
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
