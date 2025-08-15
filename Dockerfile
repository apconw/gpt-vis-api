# Use the official Node.js image
FROM node:20

# Set the working directory
WORKDIR /usr/src/app

# 安装中文字体
RUN apt-get update && apt-get install -y \
    fonts-wqy-zenhei \
    ttf-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

# ✅ 安装系统依赖（关键！包含 Chromium 运行所需的所有库）
RUN apt-get update && \
    apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpng-dev \
    # ✅ 新增：Chromium/Headless Browser 运行依赖（关键！）
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libxcb1 \
    libx11-6 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libasound2 \
    libexpat1 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpangoxft-1.0-0 \
    libdbus-1-3 \
    # ✅ 可选：调试工具
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and node-gyp globally
RUN npm install -g pnpm node-gyp

# Copy project files
COPY . .

# Install dependencies
RUN pnpm install

# Rebuild the canvas module (if needed)
RUN cd node_modules/.pnpm/canvas@2.11.2/node_modules/canvas && \
    pnpm exec node-gyp rebuild

# Expose the port
EXPOSE 3000

# Start command
CMD ["sh", "-c", "pnpm start"]