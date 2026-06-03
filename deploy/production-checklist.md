# Production Deploy Checklist

Production hiện chạy trên VPS bằng Nginx + PM2. Project này không deploy qua Vercel; nếu thấy file/cấu hình Vercel cũ thì không dùng cho production.

Run these commands once on the production server after pulling the latest code.

```bash
cd /home/flashvps/client.eventusproduction.com/client-eventus
git pull origin main
npm install
npm run db:migrate
npm run feedback:import-legacy -- --dry-run
npm run feedback:import-legacy
npm run feedback:prune -- --months=6
npm run feedback:prune -- --months=6 --force
npm run build
pm2 restart client-eventus || pm2 start npm --name client-eventus -- start
pm2 save
```

If the PM2 process has another name, run `pm2 list` and restart that process instead.

## Nginx

Use `deploy/nginx-client-eventus.conf` as the reference config for:

- proxying all traffic to the Nest server on `127.0.0.1:3000`
- long-term immutable cache for `/assets/*`
- gzip compression
- optional Brotli compression when the Nginx Brotli module is installed

After editing Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verify

```bash
curl -I https://client.eventusproduction.com/quotes
curl -I https://client.eventusproduction.com/feedbacks
curl -s https://client.eventusproduction.com/api/quotes
ASSET=$(ls apps/web/dist/assets/index-*.js | head -1 | xargs basename)
curl -I "https://client.eventusproduction.com/assets/$ASSET"
curl -H 'Accept-Encoding: gzip' -I "https://client.eventusproduction.com/assets/$ASSET"
```

Expected:

- `/quotes` returns `text/html` and does not contain `@vite/client`
- `/assets/*` returns `Cache-Control: public, max-age=31536000, immutable`
- `/api/quotes` returns JSON `200`
- gzip request returns `Content-Encoding: gzip` when Nginx compression is active

## Feedback environment

Feedback upload dùng Google Drive qua `rclone`, nên production cần có:

```bash
RCLONE_BIN=rclone
RCLONE_REMOTE=eventus
RCLONE_FEEDBACK_DIR=feedback
FEEDBACK_UPLOAD_STORAGE=rclone
YT_DLP_BIN=/usr/local/bin/yt-dlp
FFMPEG_BINARIES=ffmpeg
NHANSU_URL=https://...
```

Trước khi tắt deploy `feedback-eventus`, kiểm tra link cũ theo mẫu:

```bash
curl -I 'https://client.eventusproduction.com/feedbacks/{legacy_id}?zalo={zalo_id}'
curl -I 'https://client.eventusproduction.com/redirect/{zalo_id}'
curl -I 'https://client.eventusproduction.com/survey?job={job_public_token}'
curl -I 'https://client.eventusproduction.com/survey?job={legacy_job_id}'
curl -I 'https://client.eventusproduction.com/gallery/{zalo_id}'
```
