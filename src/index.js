require('dotenv').config();
const express = require('express');
const { render } = require('@antv/gpt-vis-ssr');
const MinIO = require('minio');


// 获取 gpt-vis-ssr 版本
let gptVisSsrVersion = 'unknown';
try {
    const gptVisSsrPackagePath = require.resolve('@antv/gpt-vis-ssr/package.json');
    const packageJson = require(gptVisSsrPackagePath);
    gptVisSsrVersion = packageJson.version;
} catch (err) {
    console.log('无法获取 gpt-vis-ssr 版本信息:', err.message);
}


const app = express();

// 设置响应头
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// 解析 JSON 请求体
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
    if (err) return console.error('检查 Bucket 失败:', err);
    if (!exists) {
        minioClient.makeBucket(BUCKET_NAME, '', function (err) {
            if (err) return console.error('创建 bucket 失败:', err);
            console.log(`Bucket ${BUCKET_NAME} 创建成功`);
        });
    }
});

/**
 * 清理 spec 对象中的 undefined 和 null 值
 */
function clean(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
        return obj
            .map(item => clean(item))
            .filter(item => item !== undefined);
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && value !== null) {
                const cleanedValue = clean(value);
                if (cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    return obj;
}

/**
 * 图表生成接口
 * 支持 flow-diagram 等类型
 */
app.post('/generate', async (req, res) => {
    const userSpec = req.body;

    // 输入校验
    if (!userSpec || typeof userSpec !== 'object') {
        return res.status(400).json({
            success: false,
            errorMessage: '请求体必须是有效 JSON 对象'
        });
    }

    let spec;
    try {
        // 深拷贝并清理 spec，避免修改原始对象
        spec = clean(JSON.parse(JSON.stringify(userSpec)));
    } catch (err) {
        return res.status(400).json({
            success: false,
            errorMessage: 'JSON 格式无效'
        });
    }

    // 强制确保 data 存在
    spec.data = spec.data || { nodes: [], edges: [] };
    spec.data.nodes = spec.data.nodes || [];
    spec.data.edges = spec.data.edges || [];

    //  // 处理 theme 字段：如果是字符串，保留为预设名；如果是对象，合并并设置字体
    // if (typeof spec.theme === 'string') {
    //     // 如果 theme 是字符串（如 "light"），则转换为对象并保留 preset，同时设置字体
    //     spec.theme = {
    //         preset: spec.theme,
    //         fontFamily: 'WenQuanYi Zen Hei'
    //     };
    // } else {
    //     // 如果 theme 是对象，则直接合并字体
    //     spec.theme = {
    //         ...spec.theme,
    //         fontFamily: 'WenQuanYi Zen Hei'
    //     };
    // }

    // ✅ 关键修复：确保所有节点 id 是字符串
    spec.data.nodes = spec.data.nodes.map((node, index) => ({
        id: String(node.id || `node_${index}`).trim(),
        type: node.type || 'default-node',
        label: node.label != null ? String(node.label) : '',
        ...node
    }));

    // ✅ 可选：确保边的 source/target 是字符串
    spec.data.edges = spec.data.edges
        .filter(edge => edge && edge.source && edge.target)
        .map(edge => ({
            source: String(edge.source),
            target: String(edge.target),
            ...edge
        }));

    // 🔥 关键：确保 extensions 不会导致问题
    if (Array.isArray(spec.extensions)) {
        spec.extensions = spec.extensions.filter(ext => ext !== undefined);
    } else {
        delete spec.extensions; // 或设为空数组
    }

    // 日志：打印处理后的 spec（调试用）
    console.log('处理后的图表配置:', JSON.stringify(spec, null, 2));

    try {
        // 调用 @antv/gpt-vis-ssr 渲染图表
        const renderResult = await render(spec);

        // 检查是否支持 toBuffer
        if (typeof renderResult?.toBuffer !== 'function') {
            console.error('renderResult 缺少 toBuffer 方法:', renderResult);
            return res.status(500).json({
                success: false,
                errorMessage: '渲染结果不支持图像导出'
            });
        }

        // 获取图像 Buffer
        const imageBuffer = await renderResult.toBuffer();

        // 生成唯一文件名
        const fileName = `charts/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.png`;

        // 上传到 MinIO
        try {
            await new Promise((resolve, reject) => {
                minioClient.putObject(BUCKET_NAME, fileName, imageBuffer, (err, etag) => {
                    if (err) reject(err);
                    else resolve(etag);
                });
            });
            console.log(`图像上传成功: ${BUCKET_NAME}/${fileName}`);
        } catch (uploadError) {
            console.error('MinIO 上传失败:', uploadError);
            return res.status(500).json({
                success: false,
                errorMessage: '图像上传失败: ' + uploadError.message
            });
        }

        // 生成公开访问 URL
        const publicDomain = process.env.MINIO_PUBLIC_DOMAIN;
        if (!publicDomain) {
            console.error('MINIO_PUBLIC_DOMAIN 环境变量未配置');
            return res.status(500).json({
                success: false,
                errorMessage: '服务器配置错误：MINIO_PUBLIC_DOMAIN 未设置'
            });
        }

        const imageUrl = `${publicDomain}/${BUCKET_NAME}/${fileName}`;

        // 返回成功响应
        res.json({
            success: true,
            resultObj: imageUrl,
            message: '图表生成并上传成功'
        });

    } catch (error) {
        console.error('【渲染失败】', error.message);
        console.error('错误堆栈:', error.stack);

        // 区分不同错误类型
        if (error.message.includes('id')) {
            return res.status(400).json({
                success: false,
                errorMessage: '图表数据中节点 id 无效，请确保每个节点都有唯一字符串 id'
            });
        }

        res.status(500).json({
            success: false,
            errorMessage: '图表渲染失败: ' + error.message
        });
    }
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        errorMessage: '接口不存在'
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        errorMessage: '服务器内部错误'
    });
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务运行在 http://localhost:${PORT}`);
    console.log(`MinIO Bucket: ${BUCKET_NAME}`);
    console.log(`gpt-vis-ssr version: ${gptVisSsrVersion}`);
});

module.exports = app;