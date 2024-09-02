const express = require('express');
const request = require('request');
const https = require('https');
const path = require('path');
const app = express();
const ageApi = require('./api/AGE');
// const onedriveApi = require('./api/onedrive');

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 使用json解析
app.use(express.json());

// 允许所有来源的跨域请求
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

// 设置路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 从AGE动漫网获取动画列表。 example: /api/getAnimeListAGE?searchText=anime_name
app.get('/api/getAnimeListAGE', async (req, res) => {
    try {
        const searchText = req.query.searchText;
        const animeList = await ageApi.getAnimeListAGE(searchText);
        res.json(animeList);
    } catch (error) {
        console.error('Error fetching anime List:', error);
        res.status(500).json({ error: 'Failed to fetch anime List' });
    }
});

// 根据id从AGE动漫网获得动画具体信息。 example: /api/getAnimeDetailAGE?id=anime_id
app.get('/api/getAnimeDetailAGE', async (req, res) => {
    try {
        const id = req.query.id;
        const animeDetail = await ageApi.getAnimeDetailAGE(id);
        res.json(animeDetail);
    } catch (error) {
        console.error('Error fetching anime Detail:', error);
        res.status(500).json({ error: 'Failed to fetch anime Detail' });
    }
});

// 根据pageUrl获取动画的播放地址。 example: /api/getAnimeUrl?pageUrl=page_url
app.get('/api/getAnimeUrl', async (req, res) => {
    try {
        const pageUrl = req.query.pageUrl;
        const animeUrl = await ageApi.getAnimeRequestUrl(pageUrl);
        res.json(animeUrl);
    } catch (error) {
        console.error('Error fetching anime Url:', error);
        res.status(500).json({ error: 'Failed to fetch anime Url' });
    }
});

// 根据papeUrl列表选择最快响应的播放地址，多个地址使用post请求。 example: /api/getFastestAnimeUrl
app.post('/api/getFastestAnimeUrl', async (req, res) => {
    try {
        const pageUrls = req.body;
        const animeUrl = await ageApi.getFastestAnimeRequestUrl(pageUrls);
        res.json(animeUrl);
    } catch (error) {
        console.error('Error fetching fastest anime Url:', error);
        res.status(500).json({ error: 'Failed to fetch fastest anime Url' });
    }
});

// 代理请求，转发视频到网页。 example: /proxy?url=video_url&headers=headers
app.get('/proxy', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        let headers = {};
        if(req.query.headers) {
            headers = JSON.parse(req.query.headers);
        }
  
      // Pipe the video response directly to the client response
    https.get(videoUrl, {
        headers: headers
    }, (videoRes) => {
        videoRes.pipe(res);
    }).on('error', (err) => {
        console.error(err);
        res.status(500).send('Proxy request failed');
    });
    } catch (error) {
        console.error('Failed to get video URL:', error);
        res.status(500).send('Failed to get video URL');
    }
});

// 从onedrive网盘获得动画列表，headers中需要authorization。 example: /api/getAnimeListOneDrive?searchText=anime_name
// app.get('/api/getAnimeListOneDrive', async (req, res) => {
//     try {
//         const searchText = req.query.searchText;
//         const authHeader = req.headers['authorization'];
//         if (!authHeader) {
//             return res.status(401).send('Authorization header missing');
//         }
//         const token = authHeader.split(' ')[1]; // Bearer token
//         if (!token) {
//             return res.status(401).send('Token missing');
//         }

//         const animeList = await onedriveApi.getAnimeList(searchText, token);
//         console.log('Anime List:', animeList);
//         res.json(animeList);
//     } catch (error) {
//         console.error('Error fetching anime List:', error);
//         res.status(500).json({ error: 'Failed to fetch anime List' });
//     }
// });

// 从onedrive网盘获得动画具体信息，headers中需要authorization。默认文件夹路径为动画名。 example: /api/getAnimeDetailOneDrive?folderPath=anime_folder_path
// app.get('/api/getAnimeDetailOneDrive', async (req, res) => {
//     try {
//         const folderPath = req.query.folderPath;
//         const authHeader = req.headers['authorization'];
//         if (!authHeader) {
//             return res.status(401).send('Authorization header missing');
//         }
//         const token = authHeader.split(' ')[1]; // Bearer token
//         if (!token) {
//             return res.status(401).send('Token missing');
//         }

//         const animeDetail = await onedriveApi.getAnimeDetail(folderPath, token);
//         res.json(animeDetail);
//     } catch (error) {
//         console.error('Error fetching anime Detail:', error);
//         res.status(500).json({ error: 'Failed to fetch anime Detail' });
//     }
// });

const args = process.argv.slice(2);
const options = {};

args.forEach((arg) => {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
        options[key.slice(2)] = value;
    }
});

// 启动服务器
const PORT = options.port || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
