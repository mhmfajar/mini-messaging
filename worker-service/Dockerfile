FROM oven/bun:alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .
RUN bun x prisma generate
RUN bun build --compile --minify ./src/index.ts --outfile worker-binary

FROM oven/bun:alpine

WORKDIR /app

COPY --from=builder /app/worker-binary ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

CMD ["./worker-binary"]
