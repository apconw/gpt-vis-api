require('dotenv').config();
const express = require('express');
const { render } = require('@antv/gpt-vis-ssr');
const MinIO = require('minio');

const app = express();
// 设置响应头
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
app.use(express.json({ limit: '10mb' }));

// MinIO 配置
const minioClient = new MinIO.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'chart-images';

// 确保 Bucket 存在
minioClient.bucketExists(BUCKET_NAME, function (err, exists) {
    if (err) return console.error(err);
    if (!exists) {
        minioClient.makeBucket(BUCKET_NAME, '', function (err) {
            if (err) return console.error('创建 bucket 失败:', err);
            console.log(`Bucket ${BUCKET_NAME} 创建成功`);
        });
    }
});

// 图表生成接口
app.post('/generate', async (req, res) => {
    const spec = req.body;
    // 指定中文字体
    spec.theme = {
        fontFamily: 'WenQuanYi Zen Hei' // 对应 Docker 里安装的文泉驿正黑字体
    };

    console.log('请求体:', spec); // 添加日志打印请求体

    try {
        const renderResult = await render(spec);
        console.log('render 函数返回值:', renderResult); // 添加日志打印返回值

        // 检查是否有 toBuffer 方法
        if (typeof renderResult.toBuffer === 'function') {
            const imageBuffer = await renderResult.toBuffer();

            const fileName = `charts/${Date.now()}.png`;

            // 上传到 MinIO
            await new Promise((resolve, reject) => {
                minioClient.putObject(BUCKET_NAME, fileName, imageBuffer, (err, etag) => {
                    if (err) reject(err);
                    else resolve(etag);
                });
            });

            // 生成不签名的 URL
            const publicDomain = process.env.MINIO_PUBLIC_DOMAIN;
            if (!publicDomain) {
                console.error('MINIO_PUBLIC_DOMAIN 环境变量未配置');
                return res.status(500).json({
                    success: false,
                    errorMessage: 'MINIO_PUBLIC_DOMAIN 环境变量未配置',
                });
            }
            const imageUrl = `${publicDomain}/${BUCKET_NAME}/${fileName}`;

            console.log('生成的不签名 URL:', imageUrl);
            res.json({
                success: true,
                resultObj: imageUrl
            });
        } else {
            console.error('render 函数返回值没有 toBuffer 方法:', renderResult);
            res.status(500).json({
                success: false,
                errorMessage: 'render 函数返回值没有 toBuffer 方法',
            });
        }
    } catch (error) {
        console.error('渲染失败:', error.message);
        res.status(500).json({
            success: false,
            errorMessage: error.message,
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务运行在 http://localhost:${PORT}`);
});