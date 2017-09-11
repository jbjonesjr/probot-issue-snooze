const createScheduler = require('probot-scheduler');
const Freeze = require('./lib/freeze');
const defaults = require('./lib/defaults');
const parseReminder = require('./lib/reminder');
const commands = require('./lib/commands');

/* Configuration Variables */

module.exports = robot => {
  commands(robot, 'remind', async (context, command) => {
    const reminder = parseReminder(command.name + ' ' + command.arguments);

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.comment.user.login;
      }

      const config = await context.config('probot-snooze.yml', defaults);
      const freeze = new Freeze(context.github, config);

      freeze.freeze(context, reminder);
    }
  });

  createScheduler(robot);

  robot.on('schedule.repository', handleThaw);

  async function handleThaw(context) {
    const config = await context.config('probot-snooze.yml', defaults);

    const freeze = new Freeze(context.github, config);
    const {owner, repo} = context.repo();
    const q = `label:"${freeze.config.labelName}" repo:${owner}/${repo}`;

    const resp = await context.github.search.issues({q});

    await Promise.all(resp.data.items.map(issue => {
      // Issue objects from the API don't include owner/repo params, so
      // setting them here with `context.repo` so we don't have to worry
      // about it later. :/
      return freeze.checkUnfreeze(context.repo(issue));
    }));
    robot.log('scheduled thaw run complete');
  }
};
