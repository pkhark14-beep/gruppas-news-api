const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL ? process.env.TELEGRAM_CHANNEL.replace('@', '') : 'gruppasnews';

let cachedPosts = [];
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // Кэшируем всю историю на 10 минут

async function fetchAllTelegramHistory() {
    let allPostsMap = new Map();
    let beforeId = '';
    let hasMore = true;
    let safetyCounter = 0; // Защита от бесконечного цикла (максимум 20 страниц по ~20 постов = ~400 постов)

    while (hasMore && safetyCounter < 20) {
        safetyCounter++;
        try {
            const url = `https://t.me/s/${CHANNEL_USERNAME}${beforeId ? '?before=' + beforeId : ''}`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            
            let pagePosts = [];

            $('.tgme_widget_message').each((i, element) => {
                const $el = $(element);
                
                // ID поста
                const postUrl = $el.find('.tgme_widget_message_date').attr('href'] || '';
                const postIdMatch = postUrl.match(/\/(\d+)(\?|$)/);
                if (!postIdMatch) return;
                const postId = postIdMatch[1];

                // Дата поста
                const dateStr = $el.find('.tgme_widget_message_date time').attr('datetime') || '';
                let formattedDate = 'Недавно';
                if (dateStr) {
                    formattedDate = new Date(dateStr).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                    });
                }

                // Текст поста
                let text = $el.find('.tgme_widget_message_text').html();
                if (text) {
                    text = text.replace(/<br\s*[\/]?>/gi, '\n');
                } else {
                    text = $el.find('.tgme_widget_message_poll_question').text() || 'Медиа-пост / Опрос';
                }
                const cleanText = $('<div>').html(text).text();

                // Картинка поста (если есть)
                let photoUrl = null;
                const $photoStyle = $el.find('.tgme_widget_message_photo_wrap');
                if ($photoStyle.length) {
                    const styleAttr = $photoStyle.attr('style') || '';
                    const match = styleAttr.match(/url\('(.*?)'\)/);
                    if (match && match[1]) {
                        photoUrl = match[1];
                    }
                }

                if (cleanText || photoUrl) {
                    pagePosts.push({
                        id: postId,
                        date: formattedDate,
                        text: cleanText,
                        photo: photoUrl
                    });
                }
            });

            if (pagePosts.length === 0) {
                hasMore = false;
            } else {
                // Находим самый первый (самый старый) ID на текущей странице для пагинации назад
                let minId = Math.min(...pagePosts.map(p => Number(p.id)));
                if (beforeId && minId >= Number(beforeId)) {
                    hasMore = false; // Если ID не уменьшаются, прекращаем цикл
                }
                beforeId = String(minId);

                // Добавляем посты в общую карту
                pagePosts.forEach(p => allPostsMap.set(p.id, p));
            }

                // Небольшая пауза между запросами, чтобы Telegram не заблокировал IP Render
                await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
            console.error('Ошибка при выгрузке истории:', e.message);
            hasMore = false;
        }
    }

    let finalPosts = Array.from(allPostsMap.values());
    // Сортируем от новых к старым (по убыванию ID)
    finalPosts.sort((a, b) => Number(b.id) - Number(a.id));
    return finalPosts;
}

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    const now = Date.now();
    // Отдаем из кэша, если он свежий
    if (cachedPosts.length > 0 && (now - lastCacheTime < CACHE_TTL)) {
        return res.json(cachedPosts);
    }

    try {
        cachedPosts = await fetchAllTelegramHistory();
        lastCacheTime = now;
        res.json(cachedPosts);
    } catch (e) {
        console.error('Ошибка API:', e);
        res.json(cachedPosts.length > 0 ? cachedPosts : []);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер авто-истории запущен на порту ${PORT}`);
});
