import { defineDisplay } from '@directus/extensions-sdk';
import DisplayComponent from './display.vue';

export default defineDisplay({
	id: 'gallery-grid-cover',
	name: 'Gallery Cover',
	icon: 'image',
	description: 'Display cover image from gallery grid',
	component: DisplayComponent,
	types: ['alias'],
	localTypes: ['files'],
	options: [
		{
			field: 'circle',
			name: 'Circle',
			type: 'boolean',
			meta: {
				interface: 'boolean',
				width: 'half',
			},
			schema: { default_value: false },
		},
		{
			field: 'size',
			name: 'Width',
			type: 'integer',
			meta: {
				interface: 'input',
				width: 'half',
				options: { min: 40, max: 400 },
			},
			schema: { default_value: 200 },
		},
	],
	fields: (options, { field, collection }) => {
		// Request the junction table data with is_cover and file info
		const junctionField = field;
		return [
			`${junctionField}.id`,
			`${junctionField}.is_cover`,
			`${junctionField}.directus_files_id.id`,
			`${junctionField}.directus_files_id.type`,
			`${junctionField}.directus_files_id.title`,
		];
	},
});
