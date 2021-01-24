#!/bin/bash

#network
docker network create -d bridge --subnet=172.18.0.0/16 docker-net

#zookeeper
docker rm -f zk-1
docker run --network docker-net --ip 172.18.1.2 --name zk-1 --restart always -d zookeeper

#cleaner
echo "cleaning zookeeper"
cd ./cleaner/
docker image build -t cleaner:v1 .
docker rm -f cleaner #stops and removes container
docker run --network docker-net --ip 172.18.1.3 --env ZK_ADDRESS=172.18.1.2:2181 -d --name cleaner -t "cleaner:v1"

#servers
cd ../server/
docker image build -t server:v1 .
docker rm -f server-1
docker rm -f server-2
docker rm -f server-3
docker rm -f server-4
docker run --network docker-net --ip 172.18.1.10 --env SERVER_ID=0 -p 9000:9000 -p 3000:3000 -d --name server-1 -t "server:v1"
docker run --network docker-net --ip 172.18.1.11 --env SERVER_ID=1 -p 9001:9001 -p 3001:3001 -d --name server-2 -t "server:v1"
docker run --network docker-net --ip 172.18.1.12 --env SERVER_ID=2 -p 9002:9002 -p 3002:3002 -d --name server-3 -t "server:v1"
docker run --network docker-net --ip 172.18.1.13 --env SERVER_ID=3 -p 9003:9003 -p 3003:3003 -d --name server-4 -t "server:v1"

sleep 2
docker rm -f cleaner