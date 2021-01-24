FROM node:latest

WORKDIR /app/cleaner

COPY package.json /app/cleaner

RUN npm install

COPY . /app/cleaner

CMD ["node" ,"index.js"]
