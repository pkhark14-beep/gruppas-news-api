const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL ? process.env.TELEGRAM_CHANNEL.replace('@', '') : 'gruppasnews';

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    try {
        // Парсим публичную веб-страницу Telegram-канала, где видны все старые посты и фото
        const url = `https://t.me/s/${CHANNEL_USERNAME}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        let posts = [];

        $('.tgme_widget_message').each((i, element) => {
            const $el = $(element);
            
            // ID поста
            const postUrl = $el.find('.tgme_widget_message_date').attr('href') || '';
            const postIdMatch = postUrl.match(/\/(\d+)(\?|$)/);
            const postId = postIdMatch ? postIdMatch[1] : i;

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
            const $textElem = $el.find('.tgme_widget_message_text');
            const text = $textElem.length ? $textElem.html().replace(/<br\s*[\/]?>/gi, '\n') : '';
            // Очищаем HTML теги внутри текста, оставляя переносы строк если нужно, или оставляем чистый текст
            const cleanText = $el.find('.tgme_widget_message_text').text();

            // Картинка (фото) поста, если она есть
            let photoUrl = null;
            const $photoStyle = $el.find('.tgme_widget_message_photo_wrap');
            if ($photoStyle.length) {
                const styleAttr = $photoStyle.attr('style') || '';
                const match = styleAttr.match(/url\('(.*?)'\)/);
                if (match && match[1]) {
                    photoUrl = match[1];
                }
            }

            // Добавляем пост, если в нем есть текст или картинка
            if (cleanText || photoUrl) {
                posts.push({
                    id: postId,
                    date: formattedDate,
                    text: cleanText || 'Медиа-пост',
                    photo: photoUrl
                });
            }
        });

        // Переворачиваем, чтобы новые были сверху
        res.json(posts.reverse());
    } catch (e) {
        console.error('Ошибка парсинга:', e);
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер новостей с поддержкой истории и фото запущен на порту ${PORT}`);
});
