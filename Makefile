# 项目名称
PROJECT_NAME := gpt-vis-api

# Docker 镜像名称
IMAGE_NAME := apconw/$(PROJECT_NAME):0.0.1

# 构建 Docker 镜像
build:
	docker build -t $(IMAGE_NAME) .

# 新增多平台构建命令
docker-build-server-multi:
	docker buildx build --platform linux/amd64,linux/arm64 --push -t $(IMAGE_NAME) -f ./Dockerfile .
