# 国内云服务器一键 Docker 部署
# 在 Linux 服务器上执行

set -e
cd "$(dirname "$0")/.."

DOMAIN="${1:-}"
if [ -n "$DOMAIN" ]; then
  export SITE_URL="https://${DOMAIN}"
  echo "SITE_URL=$SITE_URL"
fi

docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "部署完成!"
echo "健康检查: curl http://localhost/api/health"
if [ -n "$DOMAIN" ]; then
  echo "访问地址: https://${DOMAIN}"
else
  echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo '你的服务器IP')"
fi
