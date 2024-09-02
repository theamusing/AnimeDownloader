const puppeteer = require('puppeteer');

/**
* 从AGE动漫网获取资源列表，包含动画名字，每一集的pageUrl列表
* @returns {Promise} - [{name: 'anime_name', id: 'anime_id'}, ...]
*/
async function getAnimeListAGE(searchText = '', page = 1) {
    if (searchText === '' || page < 1) {
        console.log('searchText is empty');
        return null;
    }

    try {
        const response = await fetch(`https://api.agedm.org/v2/search?query=${searchText}&page=${page}`, {headers: {'referer': 'https://m.agedm.org/'}});
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (data.code !== 200) {
            throw new Error(data.message);
        }

        const dataNum = data.data.total;
        const pageNum = data.data.totalPage;

        if (dataNum === 0) {
            console.log('No anime found');
            return null;
        }

        const results = data.data.videos.map(videoInfo => ({name: videoInfo.name, id: videoInfo.id}));
        // const promises = data.data.videos.map(videoInfo => getAnimeDetailAGE(videoInfo.id));
        // const results = await Promise.all(promises);
        // console.log(results);

        if (page < pageNum) {
            const nextPageResults = await getAnimeListAGE(searchText, page + 1);
            return results.concat(nextPageResults);
        }

        return results;
    } catch (error) {
        if(error.cause)
        {
            console.log('Error fetching anime list, cause:', error.cause.code);
            if(error.cause.code === 'UND_ERR_SOCKET')
            {
                console.log('可能遭遇反爬虫机制，正在尝试使用网页抓取');
                return await getAnimeListWebScrapingAGE(searchText, page);
            }
            else
                console.error('Error fetching anime list:', error);
        }
        else
            console.error('Error fetching anime list:', error);
        return null;
    }
}

/**
* 遭遇反爬虫，使用网页抓取详细信息响应
* @returns {Promise} - [{name: 'anime_name', id: 'anime_id'}, ...]
*/
async function getAnimeListWebScrapingAGE(searchText = '', page = 1) {
    if (searchText === '' || page < 1) {
        console.log('searchText is empty');
        return null;
    }

    const browser = await puppeteer.launch();
    const browserPage = await browser.newPage();

    try {
        await browserPage.goto(`https://m.agedm.org/#/search?query=${searchText}&page=${page}`);

        const responseCondition = (response) => {
            return response.url().includes('api.agedm.org/v2/search');
        }

        const response = await browserPage.waitForResponse(responseCondition, { timeout: 10000 });

        if (!response) {
            await browser.close();
            return null;
        }

        const data = await response.json();
        await browser.close();

        if (data.code !== 200) {
            throw new Error(data.message);
        }

        const dataNum = data.data.total;
        const pageNum = data.data.totalPage;

        if (dataNum === 0) {
            console.log('No anime found');
            return null;
        }

        const results = data.data.videos.map(videoInfo => ({name: videoInfo.name, id: videoInfo.id}));

        // const promises = data.data.videos.map(videoInfo => getAnimeDetailAGE(videoInfo.id));
        // const results = await Promise.all(promises);
        // console.log(results);

        if (page < pageNum) {
            const nextPageResults = await getAnimeListWebScrapingAGE(searchText, page + 1);
            return results.concat(nextPageResults);
        }

        return results;
    } catch (error) {
        console.error('Error fetching anime list when scraping:', error);
        await browser.close();
        return null;
    }
}

/**
 * 获取动画详细信息,返回每一集的片源pageUrl列表
 * @param {string} id - anime id
 */

async function getAnimeDetailAGE(id = '') {
    try {
        const response = await fetch(`https://api.agedm.org/v2/detail/${id}`, {headers: {'referer':'https://m.agedm.org/'}});
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        // console.log(data);
        const animeName = data.video.name;

        // 寻找片源集数
        let key0 = 0;
        let episodeNum = 0;
        Object.keys(data.video.playlists).forEach(key => {
            if(data.video.playlists[key].length > episodeNum)
            {
                key0 = key;
                episodeNum = data.video.playlists[key].length;
            }
        });

        const pageUrlList = data.video.playlists[key0].map(playInfo => ({title: playInfo[0], pageUrl : []}));// 描述动画每一集的pageUrl列表。example: [{title: '第1集', pageUrl: ['https://agefans.tv/play/1234', 'https://balabala']}, ...]

        // 插入片源
        Object.keys(data.video.playlists).forEach(key => {
            data.video.playlists[key].forEach((playInfo, index) => {
                const age_link = playInfo[1];
                const url_vip = data.player_jx['vip'] + age_link; 
                const url_m3u8 = data.player_jx['zj'] + age_link;
                pageUrlList[index].pageUrl.push(url_vip);
                pageUrlList[index].pageUrl.push(url_m3u8);
            });
        });

        // console.log(pageUrlList);
        return {name : animeName, episodes : pageUrlList};
    } catch (error) {

        if(error.cause)
            {
                console.log('Error fetching anime detail, cause:', error.cause.code);
                if(error.cause.code === 'UND_ERR_SOCKET')
                {
                    console.log('可能遭遇反爬虫机制，正在尝试使用网页抓取');
                    return await getAnimeDetailWebScrapingAGE(id);
                }
                else
                    console.error('Error fetching anime list:', error);
            }
            else
                console.error('Error fetching anime list:', error);
        return null;
    }
}

/**
 * 获取动画详细信息,返回每一集的片源pageUrl列表. 使用网页抓取
 * @param {string} id - anime id
 */

async function getAnimeDetailWebScrapingAGE(id = '') {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // example 'https://m.agedm.org/#/detail/20150050'
    try {
        await page.goto(`https://m.agedm.org/#/detail/${id}`);

        const responseCondition = (response) => {
            return response.url().includes('api.agedm.org/v2/detail');
        }

        const response = await page.waitForResponse(responseCondition, { timeout: 10000 });

        if (!response) {
            await browser.close();
            return null;
        }

        const data = await response.json();
        await browser.close();

        const animeName = data.video.name;
        // 寻找片源集数
        let key0 = 0;
        let episodeNum = 0;
        Object.keys(data.video.playlists).forEach(key => {
            if(data.video.playlists[key].length > episodeNum)
            {
                key0 = key;
                episodeNum = data.video.playlists[key].length;
            }
        });

        const pageUrlList = data.video.playlists[key0].map(playInfo => ({title: playInfo[0], pageUrl : []}));// 描述动画每一集的pageUrl列表。example: [{title: '第1集', pageUrl: ['https://agefans.tv/play/1234', 'https://balabala']}, ...]


        // 插入片源
        Object.keys(data.video.playlists).forEach(key => {
            data.video.playlists[key].forEach((playInfo, index) => {
                const age_link = playInfo[1];
                const url_vip = data.player_jx['vip'] + age_link; 
                const url_m3u8 = data.player_jx['zj'] + age_link;
                pageUrlList[index].pageUrl.push(url_vip);
                pageUrlList[index].pageUrl.push(url_m3u8);
            });
        });

        // console.log(pageUrlList);
        return {name : animeName, episodes : pageUrlList};
    } catch (error) {
        console.error('Error fetching anime detail:', error);
        return null;
    }
}

/**
* 从HTML页面中查找视频请求URL
* @param {string} pageUrl - 页面URL，由age动漫网提供
*/
async function getAnimeRequestUrl(pageUrl, retries = 5) {
    console.log('正在查找视频URL:', pageUrl);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    try {   
        // 用于存储找到的视频URL
        let videoUrl = null;
        let videoType = '';
        let videoHeaders = null;

        await page.goto(pageUrl);
        
        //在请求中检测. not used
        const requestCondition = (request) => {
            // if(request.url().endsWith('.m3u8'))
            // {
            //     videoType = 'HLS';
            //     videoUrl = request.url();
            //     return true;
            // }
            // else
                return false;
        }
        //在响应中检测
        const responseCondition = (response) => {
            // console.log(response.url());
            if(response.status() == 206)// 可能是视频文件。有无更好的判断方法？
            {
                videoType = 'NORMAL';
                videoUrl = response.url();
                videoHeaders = response.request().headers();
                return true;
            }
            else if(response.status() == 403)// 请求被拒绝。抛出错误
            {
                throw new Error('Request is denied',{cause: {code: 'UND_ERR_SOCKET'}});
            } 
            else if(response.url().endsWith('.m3u8') && response.status() == 200)// url以.m3u8结尾
            {
                videoType = 'HLS';
                videoUrl = response.url();
                videoHeaders = response.request().headers();
                return true;
            }
            else if(response.url().includes('m3u8?') && response.status() == 200 && response.headers()['content-type'] && response.headers()['content-type'].startsWith('image/'))// url中包含.m3u8，伪装成图片，奇怪的方式
            {
                videoType = 'HLS';
                videoUrl = response.url();
                videoHeaders = response.request().headers();
                return true;
            }
            else 
                return false;
        }
        // 等待视频请求
        const response = await Promise.race([
            page.waitForRequest(requestCondition, {timeout: 10000}),
            page.waitForResponse(responseCondition, {timeout: 10000}),
        ]);

        if (!response) {
            console.log('未找到视频URL');
            await browser.close();
            return null;
        }  

        // responseData = await response.buffer();
        await browser.close();
        // 如果在超时时间内没有找到视频URL，关闭浏览器

        // responseData = await result.buffer();
        console.log('找到视频URL:', videoUrl);
        console.log('视频类型:', videoType);

        return {'videoType' : videoType, 'videoUrl' : videoUrl, 'videoHeaders' : videoHeaders};
    }
    catch (error) {
        console.error('发生错误:', error);
        browser.close();
        if(error.cause && error.cause.code == 'UND_ERR_SOCKET')
        {
            if(retries <= 0)
                return null;
            //retries
            console.log('请求被拒绝，剩余重试次数:', retries);
            return await getAnimeRequestUrl(pageUrl, retries - 1);
        }
        return null;
    }
    
}

/**
 * 从多个HTML页面中查找响应最快的视频请求URL
 * @param {string[]} pageUrls - 页面URL列表
 */
async function getFastestAnimeRequestUrl(pageUrls) {
    try {
        const promises = pageUrls.map(pageUrl => getAnimeRequestUrl(pageUrl));
        const result = await Promise.race(promises);
        console.log(result);
        if (!result) {
            console.log('未找到视频URL');
            return null;
        }
        return result;
    } catch (error) {
        return null;
    }

}

module.exports = {getAnimeListAGE, getAnimeDetailAGE, getAnimeRequestUrl, getFastestAnimeRequestUrl};

/*
    test functions 
*/
function test()
{
    const url = 'https://43.240.156.118:8443/vip/?url=age_d38aN%2Bd7h%2BbmX5uSQqi3kTk%2Be5P0Vt9wy1HpSlODifpIIFyFWRL34bYh2k30yyHOEk4GctNJH3dlHj%2BtRBXgY1lT2w';
    // fetch(url)
    //   .then(response => {
    //     if (!response.ok) {
    //       throw new Error('Network response was not ok ' + response.statusText);
    //     }
    //     return response.text();
    //   })
    //   .then(data => {
    //     console.log(data);
    //   })
    //   .catch(error => {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   });   
    getAnimeRequestUrl(url);   
}


function test_xg(url = '')
{
    const headers = new Headers({
        'authority': 'v3-cha.toutiaovod.com',
        'scheme': 'https',
        'accept': '*/*',
        'accept-encoding': 'identity;q=1, *;q=0',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        // 'cookie': 'ttwid=1%7CtZ4XYxThHOFO_PnJZyZpqbw8vYH0iWoW0SvTqSFwkNM%7C1722093858%7Cdec0545778f3d82332a2043add98a7548e9e999a63e19e86aa7581cc827bcde5',
        'pragma': 'no-cache',
        'priority': 'i',
        'range': 'bytes=0-',
        // 'referer': 'https://www.ixigua.com.52flv.cc:7788/',
        'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'video',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
    });
    fetch(url, 
        {
            method: 'GET',
            headers: headers
        }
    )
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
    });
}

// test_xg('https://v3-cha.toutiaovod.com/ebe5fe248e2f7677b5e743a99f53be9a/66a5341a/video/tos/cn/tos-cn-ve-0004c800/539f4bcd14a245e290c9294d1a33dd22/');