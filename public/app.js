

let animeName = '';
let episodeName = '';
let requestUrl = null;
let requestHeaders = null;
let videoType = '';
let videoInfo = null;


document.getElementById('searchBtn').onclick = () => {
    const animeList = document.getElementById('animeList');
    animeList.innerHTML = ''; // 清空视频列表

    const searchText = document.getElementById('searchBox').value.toLowerCase();
    console.log('Searching for:', searchText);
    // getAnimeListOnedrive(searchText);
    // getAnimeListAGE(searchText);

    // 获取资源列表
    fetch('/api/getAnimeListAGE?searchText=' + searchText)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
        // 根据动画列表创建下拉列表
        data.forEach(anime => {
            // 异常情况忽略
            if(!anime)
                return;
            const option = document.createElement('option');
            option.textContent = anime.name;
            option.value = anime.id;
            animeList.appendChild(option);
            animeList.style.display = 'flex'; // 显示视频列表
        });
    })
    .catch(error => {
        console.error('Error fetching anime list:', error);
    });
};

// 点击动画列表项时获取对应动画的集数列表
document.getElementById('animeList').onchange = (event) => {
    const episodeList = document.getElementById('episodeList');
    episodeList.innerHTML = ''; // 清空集数列表

    const selectedOption = event.target.selectedOptions[0];
    console.log('you just clicked ' + selectedOption.textContent);
    animeName = selectedOption.textContent;
    const id = selectedOption.value;

    // 获取动画集数列表
    fetch('/api/getAnimeDetailAGE?id=' + id)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log(data);

        data.episodes.forEach(episode => {
            const option = document.createElement('option');
            option.textContent = episode.title;
            option.value = JSON.stringify({source : 'AGE', url : episode.pageUrl});
            episodeList.appendChild(option);
        });      
        episodeList.style.display = 'flex'; // 显示视频列表
    })
    .catch(error => {
        console.error('Error fetching anime detail:', error);
    });
};

// 点击集数列表项时播放对应集视频
document.getElementById('episodeList').onchange = (event) => {
    const selectedOption = event.target.selectedOptions[0];
    console.log('you just clicked ' + selectedOption.textContent);
    episodeName = selectedOption.textContent;
    videoInfo = JSON.parse(selectedOption.value);
    tryPlayAnime();
};

document.getElementById('retryBtn').onclick = tryPlayAnime;

document.getElementById('downloadBtn').onclick = downloadVideo;

function tryPlayAnime() {
    const loading = document.getElementById('loading');
    const retryBtn = document.getElementById('retryBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const animeUrlText = document.getElementById('animeUrlText');
    const animeTypeText = document.getElementById('animeTypeText');
    loading.style.display = 'block';
    retryBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
    animeUrlText.style.display = 'none';
    animeTypeText.style.display = 'none';

    if(!videoInfo || !videoInfo.url)
    {
        console.log('No video to play');
        return;
    }

    console.log('Playing video:', videoInfo.url);
    switch (videoInfo.source) {
        case 'Onedrive':
            playVideo(videoInfo.url);
            break;
        case 'AGE':
            // 获取播放地址
            fetch('/api/getFastestAnimeUrl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(videoInfo.url)
            })
            // fetch('/api/getAnimeUrl?pageUrl=' + videoInfo.url[0])
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log(data);
                loading.style.display = 'none';
                retryBtn.style.display = 'block';
                animeUrlText.style.display = 'block';
                animeTypeText.style.display = 'block';
                // 未获取到视频地址
                if(!data)
                {
                    console.log('Failed to get video url');
                    animeUrlText.value = 'Failed to get video url';
                    animeTypeText.value = '';
                    return;
                }
                downloadBtn.style.display = 'block';
                animeUrlText.value = data.videoUrl;
                animeTypeText.value = data.videoType;
                if(data.videoType == 'HLS')
                {
                    playVideoHLS(data.videoUrl);
                }
                else if(data.videoType == 'NORMAL')
                {
                    if(data.videoHeaders)
                        playVideoWithHeaders(data.videoUrl, data.videoHeaders);
                    else
                        playVideo(data.videoUrl);
                }
                else
                {
                    console.log('Unknown video type: ' + data.videoType);
                }
            })
    }
}

function playVideo(videoUrl) {
    console.log('Playing video:', videoUrl);
    const videoPlayer = document.getElementById('videoPlayer');   
    videoPlayer.src = videoUrl;
    videoPlayer.load();
    videoPlayer.style.display = 'block';   

    videoType = 'NORMAL';
    requestUrl = videoUrl;
}

function playVideoHLS(videoUrl) {
    console.log('Playing HLS video:', videoUrl);
    const videoPlayer = document.getElementById('videoPlayer');
    const hls = new Hls();
    hls.loadSource(videoUrl);
    hls.attachMedia(videoPlayer);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer.play();
    }); 
    videoPlayer.style.display = 'block';

    videoType = 'HLS';
    requestUrl = videoUrl;
}

// 该函数用于播放需要特定请求头的视频，由服务器转发视频(例如西瓜视频)
function playVideoWithHeaders(videoUrl, headers = {}) {
    const videoPlayer = document.getElementById('videoPlayer'); 
    const proxyUrl = `/proxy?url=${encodeURIComponent(videoUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`; 

    videoPlayer.src = proxyUrl;
    videoPlayer.load();
    videoPlayer.style.display = 'block'; 

    videoType = 'NORMAL';
    requestUrl = proxyUrl;
}

function downloadVideo() {
    if(!requestUrl || !animeName || !episodeName)
    {
        console.log('No video to download');
        return;
    }
    if(videoType == 'NORMAL')
    {
        const a = document.createElement('a');
        a.href = requestUrl;
        a.download = animeName + ' ' + episodeName + '.mp4';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }
    else if(videoType == 'HLS')
    {
        downloadHLS(requestUrl, animeName + ' ' + episodeName + '.mp4');
    }
    else
    {
        console.log('Unknown video type: ' + videoType);
        return;
    }
}
  