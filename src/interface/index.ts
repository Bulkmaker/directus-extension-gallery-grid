import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'gallery-grid',
	name: 'Gallery Grid',
	icon: 'grid_view',
	description: 'Display files as a grid gallery',
	component: InterfaceComponent,
	types: ['alias'],
	localTypes: ['files'],
	group: 'relational',
	relational: true,
	options: [
		{
			field: 'folder',
			name: '$t:interfaces.system-folder.folder',
			type: 'uuid',
			meta: {
				interface: 'system-folder',
				width: 'half',
			},
		},
		{
			field: 'columns',
			name: 'Columns',
			type: 'integer',
			meta: {
				interface: 'input',
				width: 'half',
				options: { min: 1, max: 8 },
			},
			schema: { default_value: 4 },
		},
		{
			field: 'quickTags',
			name: 'Quick Tags',
			type: 'json',
			meta: {
				interface: 'tags',
				width: 'full',
				note: 'Predefined tags for quick selection (e.g., landscape, interior, facade)',
			},
			schema: { default_value: [] },
		},
	],
	recommendedDisplays: ['gallery-grid-cover'],
});
