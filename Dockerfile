# Use the official Node.js image (Alpine can be used but requires additional dependencies)
FROM node:18

# Set the working directory
WORKDIR /usr/src/app


# 安装字体相关依赖
RUN apt-get update && apt-get install -y \
    fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

# Install system dependencies (critical part!)
RUN apt-get update && \
    apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpng-dev && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm and node-gyp globally
RUN npm install -g pnpm node-gyp

# Copy project files
COPY . .

# Install dependencies
RUN pnpm install

# Rebuild the canvas module
RUN cd node_modules/.pnpm/canvas@2.11.2/node_modules/canvas && \
    pnpm exec node-gyp rebuild

# Build (if necessary)
# RUN pnpm build

# Expose the port
EXPOSE 3000

# Start command
CMD ["pnpm", "start"]