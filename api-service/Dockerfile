FROM oven/bun:alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .
RUN bun x prisma generate
RUN bun run build
RUN bun build --compile --minify ./dist/src/main.js --outfile api-service-binary \
    --external mqtt \
    --external kafkajs \
    --external "@grpc/grpc-js" \
    --external "@grpc/proto-loader" \
    --external nats

FROM oven/bun:alpine

WORKDIR /app

COPY --from=builder /app/api-service-binary ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/package.json ./

EXPOSE 3001

CMD ["sh", "-c", "bun x prisma db push --url \"$DATABASE_URL\" && ./api-service-binary"]
