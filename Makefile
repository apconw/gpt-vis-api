# 项目名称
PROJECT_NAME := gpt-vis-api

# Docker 镜像名称
IMAGE_NAME := $(PROJECT_NAME)

# Docker 容器名称
CONTAINER_NAME := $(PROJECT_NAME)

# 构建 Docker 镜像
build:
	docker build -t $(IMAGE_NAME) .

# 启动 Docker 容器
up:
	docker-compose up -d

# 停止 Docker 容器
down:
	docker-compose down

# 重启 Docker 容器
restart: down up

# 清理 Docker 容器和镜像
clean: down
	docker rmi -f $(IMAGE_NAME)

# 查看日志
logs:
	docker-compose logs -f $(CONTAINER_NAME)

# 进入容器
exec:
	docker exec -it $(CONTAINER_NAME) sh

# 安装依赖（在容器内）
install:
	docker exec -it $(CONTAINER_NAME) pnpm install

# 显示帮助信息
help:
	@echo "可用的命令:"
	@echo "  build    构建 Docker 镜像"
	@echo "  up       启动 Docker 容器"
	@echo "  down     停止 Docker 容器"
	@echo "  restart  重启 Docker 容器"
	@echo "  clean    清理 Docker 容器和镜像"
	@echo "  logs     查看容器日志"
	@echo "  exec     进入容器"
	@echo "  install  在容器内安装依赖"
	@echo "  help     显示帮助信息"

.PHONY: build up down restart clean logs exec install help