# Dashboard Carousel [![Build Status](https://travis-ci.org/tlaanemaa/dashboard-carousel.svg?branch=master)](https://travis-ci.org/tlaanemaa/dashboard-carousel)
_A dashboard to allow showing and managing of different websites on a remote screen_

This project was initially born from the need to show service monitoring metrics on the TVs in our office. It gradually grew from a static HTML page, full of fancy graphs, to a full-stack application with a management interface that allows changing the content remotely and many more new features. By now, its grown into a system that allows displaying, and rotating through, multiple webpages, show arbitrary messages, play sounds, read text out loud and much more. Since there appeared to be quite a bit of interest for this project as a monitoring, or even just social, tool then we decided to share it with the world and open-source it for everyone to use.

## Usage
_Requires [node.js](https://nodejs.org/en/download/) v8.0 or later_

_Since this service relies on sockets, that live in process memory, being matched with http requests, that are stateless, it wont currently work reliably behind a load balancer_

There are a number of ways to start your very own dashboard-carousel server. Perhaps the easiest way is to use it as a CLI tool, that way you only have to install the package, start it and you're done. If you prefer not to run node.js in your environment then you can use the docker container which is equally simple to set up. Lastly, if you already have a server and just want to have dashboards available as a route on that server then just install dashboard-carousel in your project and use it as a router.
### As a CLI tool
Just install the package and run the CLI command
```sh
npm install -g dashboard-carousel
dashboard-carousel
```
Additionally, you can specify the port it listens on as an environment variable
```sh
PORT=1234 dashboard-carousel
```
It will create a folder called `dashboard-files` in your current working directory, with two sub-folders
* `audio` - All mp3 files put here will show up on the management page and can be played on the dashboard
* `database` - This is where dashboard carousel keeps its database of rooms and their configurations. Feel free to back this file up if you wish
### As a docker container
To run it as a docker container, clone the repository and build the image.
Then create a volume that will be used by the container to persist it's data.
Next, just run that container, forward the port it listens to, attach the volume (or use a bind mount) and optionally give the container a name
```sh
git clone https://github.com/tlaanemaa/dashboard-carousel.git
cd dashboard-carousel
docker build -t dashboard-carousel:latest .

docker volume create dashboard-data
docker run -d -p 8080:8080 --name dashboard-carousel -v dashboard-data:/app/dashboard-files dashboard-carousel:latest
```
The created volume will contain two folders:
* `audio` - All mp3 files put here will show up on the management page and can be played on the dashboard
* `database` - This is where dashboard carousel keep's its database of rooms and their configurations. Feel free to back this file up if you wish

You can use a bind mount instead of a volume for easier access to the audio folder.
### As a project dependency
First, install the package
```sh
npm install --save dashboard-carousel
```
Dashboard carousel exports a function that takes a http server and returns an express.js router.
It needs that http server to attach it's socket.io server to it.
The router can then be used by attaching it to an existing express app.

_Note that you must call listen on the http server object not on the express app object._
```js
const app = require('express')();
const server = require('http').Server(app);
const dashboard = require('dashboard-carousel')(server);

app.use('/my-path', dashboard);

server.listen(8080, () => console.log('Listening on port 8080'));
```
There is also a named export `listen` that can be used as a plug-and-play way to start the server.
```js
const dashboard = require('dashboard-carousel');

dashboard.listen(8080, () => console.log('Listening on port 8080'));
```
It will create a folder called `dashboard-files` at the root of your project, with two sub-folders
* `audio` - All mp3 files put here will show up on the management page and can be played on the dashboard
* `database` - This is where dashboard carousel keep's its database of rooms and their configurations. Feel free to back this file up if you wish

## Using the dashboard
There are two main websites, one for showing on a TV, the dashboard, and one for management.
It also automatically generates 'rooms' based on the URL that was used to access the dashboard or the management page.
The last part of the URL will be used as the room name and match management pages with dashboards.
The urls for those pages, if dashboard-carousel is ran as a CLI tool or container on port 8080, would be:
* `localhost:8080/dashboard/{room-name}` - Dashboard, this should be opened on your TV. Replace the `{room-name}` part with the name of your room. You can use the `?setup` URL param to show a setup guide with relevant links on the dashboard page.
* `localhost:8080/dashboard-management/{room-name}` - Management page, this is where you can add frames (webpages), play sounds, send messages and more. Replace the `{room-name}` part with the name of your room

Since this project depends on iFrames to show webpages on your dashboard, it requires some setup before it can be used fully.

_This assumes that you are using chrome web browser on your TV. If you are using another browser, look up how to do the same operations in that browser_
- [Install this extension on your TV's browser to allow displaying any website in an iframe](https://chrome.google.com/webstore/detail/ignore-x-frame-headers/gleekbfjekiniecknbkamfmkohkpodhe)
- [Allow mixed content on your TV's browser to allow showing http sites in an iframe](https://www.howtogeek.com/181911/htg-explains-what-exactly-is-a-mixed-content-warning/)
  - Note: This is mainly needed when dashboard-carousel is hosted with https and the shield icon might not show up before you actually open a http webpage on your dashboard.
- To get audio support you need to open `chrome://flags/#autoplay-policy` in your TV's browser and set the autoplay-policy flag to `No user gesture is required`
