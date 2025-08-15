# 项目名称
PROJECT_NAME := gpt-vis-api

# Docker 镜像名称
IMAGE_NAME := apconw/$(PROJECT_NAME):0.0.1

# 阿里云镜像仓库地址 (需要根据实际情况修改)
ALIYUN_REGISTRY = crpi-7xkxsdc0iki61l0q.cn-hangzhou.personal.cr.aliyuncs.com
ALIYUN_NAMESPACE = apconw
ALIYUN_IMAGE_NAME = $(ALIYUN_REGISTRY)/$(ALIYUN_NAMESPACE)/$(PROJECT_NAME)

# 构建 Docker 镜像
build:
	docker build -t $(IMAGE_NAME) .

# 新增多平台构建命令
docker-build-server-multi:
	docker buildx build --platform linux/amd64,linux/arm64 --push -t $(IMAGE_NAME) -f ./Dockerfile .


# 构建服务端arm64/amd64架构镜像并推送至阿里云镜像仓库
docker-build-aliyun-multi:
	docker buildx build --platform linux/amd64,linux/arm64 --push -t $(ALIYUN_IMAGE_NAME):0.0.1 -f ./Dockerfile .
