# =============================================================
#  LoanPro — Frontend Dockerfile
#  Build context: ./frontend
#  Copies all static assets into nginx and drops a custom
#  server block that also reverse-proxies /api → backend.
# =============================================================

FROM nginx:1.25-alpine

# Remove the default nginx welcome page / config
RUN rm -rf /usr/share/nginx/html/* \
 && rm /etc/nginx/conf.d/default.conf

# Copy static frontend files
COPY . /usr/share/nginx/html

# Drop in our custom server block
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx can read all files
RUN chown -R nginx:nginx /usr/share/nginx/html \
 && chmod -R 755 /usr/share/nginx/html

EXPOSE 80

# nginx is PID 1; no daemon mode so Docker sees stdout/stderr
CMD ["nginx", "-g", "daemon off;"]
