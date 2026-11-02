const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL ? process.env.TELEGRAM_CHANNEL.replace('@', '') : 'gruppasnews';

app.get('/api/news', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    try {
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

            // Текст поста или описание опроса/медиа
            let text = $el.find('.tgme_widget_message_text').html();
            if (text) {
                // Заменяем теги переноса строк на нормальные
                text = text.replace(/<br\s*[\/]?>/gi, '\n');
            } else {
                // Если это опрос или медиа без текстового блока, пробуем взять подпись или указать тип
                text = $el.find('.tgme_widget_message_poll_question').text() || 'Медиа-пост / Опрос';
            }

            // Очищаем от HTML тегов для чистого текста
            const cleanText = $('<div>').html(text).text();

            // Картинка поста
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
                posts.push({
                    id: postId,
                    date: formattedDate,
                    text: cleanText,
                    photo: photoUrl
                });
            }
        });

        // Отдаем в правильном хронологическом порядке (новые сверху)
        res.json(posts.reverse());
    } catch (e) {
        console.error('Ошибка парсинга:', e);
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
