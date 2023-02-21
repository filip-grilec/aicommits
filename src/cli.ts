import { execa } from 'execa';
import {
	black, dim, green, red, bgCyan,
} from 'kolorist';
import {
	intro, outro, spinner, select, confirm, isCancel,
} from '@clack/prompts';
import { cli } from 'cleye';
import { description, version } from '../package.json';
import {
	getConfig,
	assertGitRepo,
	getStagedDiff,
	getDetectedMessage,
	generateCommitMessage,
	stageAll,
} from './utils.js';

const argv = cli({
	name: 'aicommits',

	version,

	flags: {
		generate: {
			type: Number,
			description: 'Number of messages to generate. (Warning: generating multiple costs more)',
			alias: 'g',
			default: 1,
		},
	},

	help: {
		description,
	},
});

(async () => {
	intro(bgCyan(black(' aicommits ')));

	await assertGitRepo();

	const detectingFiles = spinner();
	detectingFiles.start('Detecting staged files');

	await stageAll();
	const staged = await getStagedDiff();

	if (!staged) {
		throw new Error('No staged changes found. Make sure to stage your changes with `git add`.');
	}

	detectingFiles.stop(`${getDetectedMessage(staged.files)}:\n${
		staged.files.map(file => `     ${file}`).join('\n')
	}`);

	const config = await getConfig();
	const OPENAI_KEY = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? config.OPENAI_KEY;
	if (!OPENAI_KEY) {
		throw new Error('Please set your OpenAI API key in ~/.aicommits');
	}

	const s = spinner();
	s.start('The AI is analyzing your changes');
	const messages = await generateCommitMessage(
		OPENAI_KEY,
		staged.diff,
		argv.flags.generate,
	);
	s.stop('Changes analyzed');

	let message;
	if (messages.length === 1) {
		[message] = messages;

		// print message
		outro('Message \n ' + green(message));
	}

})().catch((error) => {
	outro(`${red('✖')} ${error.message}`);
	process.exit(1);
});
