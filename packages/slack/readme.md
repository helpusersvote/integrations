# @helpusersvote/integrations

Check out on the [Slack App Directory →](https://slack.com/apps/AC4FLGD2S-us-election-countdown)


## Development

First install the dependencies with:

```sh
npm install
# or with yarn
yarn
```

Create a demo Slack app, get the client ID/secret and put in a `.env` file:

```
echo "SLACK_CLIENT_ID=$SLACK_CLIENT_ID" > .env
echo "SLACK_CLIENT_SECRET=$SLACK_CLIENT_SECRET" > .env
```

Now you can just run the app:

```
npm start
# or in development, requires nodemon
npm run dev
```