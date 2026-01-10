<template>
	<div v-if="coverFileId" class="cover-display" :class="{ circle }" :style="imageStyle">
		<img
			:src="`/assets/${coverFileId}?width=400&quality=80&fit=contain`"
			:alt="''"
			@error="onImageError"
		/>
		<div v-if="imageError" class="file-icon">
			<v-icon name="insert_drive_file" />
		</div>
	</div>
	<div v-else-if="loading" class="cover-display placeholder" :class="{ circle }" :style="imageStyle">
		<v-progress-circular indeterminate x-small />
	</div>
	<div v-else-if="hasValue" class="cover-display placeholder" :class="{ circle }" :style="imageStyle">
		<v-icon name="image" />
	</div>
	<span v-else class="no-files">—</span>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';

const props = defineProps<{
	value: any[] | null;
	collection: string;
	field: string;
	circle?: boolean;
	size?: number;
}>();

const api = useApi();
const { useRelationsStore } = useStores();
const relationsStore = useRelationsStore();

const loading = ref(false);
const imageError = ref(false);
const coverFileId = ref<string | null>(null);

const hasValue = computed(() => {
	return props.value && Array.isArray(props.value) && props.value.length > 0;
});

const relationInfo = computed(() => {
	const relations = relationsStore.relations;

	const junctionRelation = relations.find((r: any) =>
		r.related_collection === props.collection &&
		r.meta?.one_field === props.field
	);

	if (!junctionRelation) return null;

	const fileRelation = relations.find((r: any) =>
		r.collection === junctionRelation.collection &&
		r.related_collection === 'directus_files'
	);

	return {
		junctionCollection: junctionRelation.collection,
		fileField: fileRelation?.field || 'directus_files_id',
	};
});

const imageStyle = computed(() => {
	const size = props.size || 200;
	return {
		width: `${size}px`,
		height: 'auto',
		minHeight: '40px',
	};
});

function onImageError() {
	imageError.value = true;
}

// Watch value and fetch cover file
watch(
	() => props.value,
	async (newValue) => {
		coverFileId.value = null;
		imageError.value = false;

		if (!newValue || !Array.isArray(newValue) || newValue.length === 0) {
			return;
		}

		if (!relationInfo.value) return;

		const { junctionCollection, fileField } = relationInfo.value;

		// Get junction IDs
		const junctionIds = newValue
			.map(v => typeof v === 'object' && v !== null ? v.id : v)
			.filter(id => id && (typeof id === 'number' || typeof id === 'string'));

		if (junctionIds.length === 0) return;

		loading.value = true;

		try {
			const response = await api.get(`/items/${junctionCollection}`, {
				params: {
					filter: { id: { _in: junctionIds } },
					fields: ['id', 'is_cover', fileField],
					limit: -1,
				},
			});

			const items = response.data?.data || [];

			// Find cover item
			let coverItem = items.find((item: any) => item.is_cover === true);
			if (!coverItem && items.length > 0) {
				coverItem = items[0];
			}

			if (coverItem) {
				const fileData = coverItem[fileField];
				if (typeof fileData === 'object' && fileData?.id) {
					coverFileId.value = String(fileData.id);
				} else if (typeof fileData === 'string' || typeof fileData === 'number') {
					coverFileId.value = String(fileData);
				}
			}
		} catch (e) {
			console.error('Failed to load cover image:', e);
		} finally {
			loading.value = false;
		}
	},
	{ immediate: true }
);
</script>

<style scoped>
.cover-display {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border-radius: var(--theme--border-radius);
	background: var(--theme--background-subdued);
}

.cover-display.circle {
	border-radius: 50%;
}

.cover-display img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.file-icon {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--theme--foreground-subdued);
	background: var(--theme--background-subdued);
}

.placeholder {
	color: var(--theme--foreground-subdued);
}

.no-files {
	color: var(--theme--foreground-subdued);
}
</style>
