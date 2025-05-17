const play = require("play-dl");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ytb",
  description: "Download YouTube videos or audio",
  execute: async (client, message, args) => {
    try {
      if (args.length < 2) {
        return client.sendMessage(message.chatId, "❌ Invalid format! Use: +ytb <URL> -a (audio) or -v (video)");
      }

      let url = args[0];
      let option = args[1];

      if (!play.yt_validate(url)) {
        return client.sendMessage(message.chatId, "❌ Invalid YouTube URL!");
      }

      let stream;
      let filePath;
      let fileName;

      if (option === "-a" || option === "-audio") {
        let info = await play.video_info(url);
        stream = await play.stream_from_info(info, { quality: 128 });
        fileName = `audio_${Date.now()}.mp3`;
        filePath = path.join(__dirname, "../../downloads/", fileName);
      } else if (option === "-v" || option === "-video") {
        let info = await play.video_info(url);
        stream = await play.stream_from_info(info, { quality: 720 });
        fileName = `video_${Date.now()}.mp4`;
        filePath = path.join(__dirname, "../../downloads/", fileName);
      } else {
        return client.sendMessage(message.chatId, "❌ Invalid option! Use -a (audio) or -v (video)");
      }

      const writeStream = fs.createWriteStream(filePath);
      stream.stream.pipe(writeStream);

      writeStream.on("finish", async () => {
        await client.sendMessage(message.chatId, {
          document: fs.readFileSync(filePath),
          mimetype: option.includes("a") ? "audio/mp3" : "video/mp4",
          fileName: fileName,
        });

        fs.unlinkSync(filePath); // Delete file after sending
      });

      writeStream.on("error", () => {
        client.sendMessage(message.chatId, "❌ Error downloading media.");
      });

    } catch (error) {
      console.error(error);
      client.sendMessage(message.chatId, "❌ Error downloading media.");
    }
  },
};