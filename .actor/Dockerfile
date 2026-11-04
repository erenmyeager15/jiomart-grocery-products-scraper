FROM apify/actor-node:22

COPY --chown=myuser package*.json ./
RUN npm ci --include=dev

COPY --chown=myuser . ./
RUN npm run build && npm prune --omit=dev --no-package-lock

CMD npm start --silent

