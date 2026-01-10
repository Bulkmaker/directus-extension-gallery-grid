<template>
	<div
		class="gallery-grid"
		:class="{ 'drag-over': isDraggingOver }"
		@dragenter.prevent="onDragEnter"
		@dragover.prevent="onDragOver"
		@dragleave.prevent="onDragLeave"
		@drop.prevent="onFileDrop"
	>
		<!-- Drop Overlay -->
		<div v-if="isDraggingOver && !disabled" class="drop-overlay">
			<v-icon name="cloud_upload" x-large />
			<span>{{ t('drop_files') }}</span>
		</div>

		<!-- Upload Progress Overlay -->
		<div v-if="uploading" class="upload-overlay">
			<div class="upload-status">
				<v-progress-circular indeterminate />
				<span>{{ t('uploading_files', { current: uploadProgress.current, total: uploadProgress.total }) }}</span>
			</div>
			<v-progress-linear :value="uploadProgressPercent" />
		</div>

		<!-- Loading -->
		<v-progress-linear v-if="loading" indeterminate />

		<!-- Grid -->
		<Draggable
			v-else-if="fileItems.length > 0"
			v-model="fileItems"
			item-key="$uid"
			class="grid"
			:style="{ '--columns': columns }"
			:disabled="disabled"
			:animation="150"
			ghost-class="ghost"
			@end="onSortEnd"
		>
			<template #item="{ element: item, index }">
				<div class="grid-item" :class="{ 'is-cover': item.is_cover, 'is-loading': !item.file }">
					<!-- Cover Button -->
					<button
						v-if="!disabled && item.file"
						class="cover-btn"
						:class="{ active: item.is_cover }"
						@click.stop="toggleCover(index)"
						:title="item.is_cover ? t('remove_cover') : t('set_as_cover')"
					>
						<v-icon :name="item.is_cover ? 'star' : 'star_border'" small />
					</button>

					<!-- Preview -->
					<div class="preview">
						<!-- Image preview -->
						<v-image
							v-if="item.file?.type?.startsWith('image/')"
							:src="`/assets/${item.file.id}?key=system-medium-cover`"
							:alt="item.file.title || ''"
						/>
						<!-- Loading state -->
						<div v-else-if="!item.file" class="file-placeholder loading">
							<v-progress-circular indeterminate small />
						</div>
						<!-- Non-image file -->
						<div v-else class="file-placeholder">
							<v-icon name="insert_drive_file" x-large />
						</div>
						<!-- Preview overlay with action buttons -->
						<div v-if="item.file && !disabled" class="preview-overlay">
							<button
								class="preview-action"
								@click.stop="openFileEditor(item)"
								:title="t('edit_metadata')"
							>
								<v-icon name="info" />
							</button>
							<button
								v-if="item.file?.type?.startsWith('image/')"
								class="preview-action"
								@click.stop="openImageEditor(item)"
								:title="t('edit_image')"
							>
								<v-icon name="tune" />
							</button>
						</div>
					</div>

					<!-- Tags -->
					<div class="tags-row" v-if="item.file">
						<div class="tags-list">
							<span
								v-for="tag in (item.tags || [])"
								:key="tag"
								class="tag-chip"
								@click.stop="!disabled && removeTag(index, tag)"
							>
								{{ tag }}
								<v-icon v-if="!disabled" name="close" x-small class="tag-remove" />
							</span>
							<button
								v-if="!disabled"
								class="add-tag-btn"
								@click.stop="openTagPicker(index)"
								:class="{ active: activeTagPicker === index }"
							>
								<v-icon name="add" x-small />
							</button>
						</div>
						<!-- Tag Picker Dropdown -->
						<div v-if="activeTagPicker === index" class="tag-picker" @click.stop>
							<div v-if="quickTags && quickTags.length > 0" class="quick-tags">
								<span
									v-for="qTag in quickTags"
									:key="qTag"
									class="quick-tag"
									:class="{ selected: (item.tags || []).includes(qTag) }"
									@click="toggleTag(index, qTag)"
								>
									{{ qTag }}
								</span>
							</div>
							<div class="custom-tag-input">
								<input
									v-model="customTagInput"
									type="text"
									:placeholder="t('add_tag')"
									@keyup.enter="addCustomTag(index)"
									@keyup.esc="closeTagPicker"
								/>
								<button @click="addCustomTag(index)" :disabled="!customTagInput.trim()">
									<v-icon name="add" x-small />
								</button>
							</div>
						</div>
					</div>

					<!-- Info -->
					<div class="info">
						<span class="title">{{ item.file?.title || item.file?.filename_download || t('loading') }}</span>
					</div>

					<!-- Remove Button -->
					<button
						v-if="!disabled"
						class="remove-btn"
						@click.stop="removeItem(index)"
					>
						<v-icon name="close" small />
					</button>
				</div>
			</template>
		</Draggable>

		<!-- Empty State -->
		<div v-else class="empty" @click="openUpload">
			<v-icon name="add_photo_alternate" x-large />
			<span>{{ t('click_to_add') }}</span>
		</div>

		<!-- Action Buttons -->
		<div v-if="!disabled && fileItems.length > 0" class="action-buttons">
			<v-button small @click="openUpload">
				<v-icon name="add" small left />
				{{ t('add_files') }}
			</v-button>
			<v-button small kind="danger" @click="removeAllItems">
				<v-icon name="delete_sweep" small left />
				{{ t('delete_all') }}
			</v-button>
		</div>

		<!-- Upload Drawer -->
		<v-drawer
			v-model="uploadOpen"
			:title="t('select_files')"
			icon="folder"
			@cancel="uploadOpen = false"
		>
			<div class="upload-content">
				<v-upload
					multiple
					:folder="folder"
					from-library
					from-url
					@input="onUpload"
				/>
			</div>
		</v-drawer>

		<!-- File Editor Drawer -->
		<drawer-item
			v-if="editingFileId"
			:active="fileEditorOpen"
			collection="directus_files"
			:primary-key="editingFileId"
			@update:active="closeFileEditor"
			@input="onFileUpdated"
		/>

		<!-- Delete Confirmation Dialog -->
		<v-dialog v-model="deleteDialogOpen" @esc="cancelDelete">
			<v-card>
				<v-card-title>{{ deletingAll ? t('delete_all_files') : t('delete_file') }}</v-card-title>
				<v-card-text>
					<span v-if="deletingAll">
						{{ t('delete_all_count', { count: fileItems.length }) }}
					</span>
					<span v-else-if="deletingItem?.file?.title || deletingItem?.file?.filename_download">
						{{ deletingItem?.file?.title || deletingItem?.file?.filename_download }}
					</span>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="cancelDelete">
						<v-icon name="close" small left />
						{{ t('cancel') }}
					</v-button>
					<v-button kind="warning" @click="confirmRemove">
						<v-icon name="link_off" small left />
						{{ deletingAll ? t('unlink_all') : t('unlink') }}
					</v-button>
					<v-button kind="danger" @click="confirmDelete">
						<v-icon name="delete" small left />
						{{ deletingAll ? t('delete_all') : t('delete') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import Draggable from 'vuedraggable';

const props = defineProps<{
	value: any[] | null;
	collection: string;
	field: string;
	disabled?: boolean;
	folder?: string;
	columns?: number;
	quickTags?: string[];
}>();

const emit = defineEmits<{
	(e: 'input', value: any[] | null): void;
}>();

const api = useApi();
const { useRelationsStore, useUserStore } = useStores();
const relationsStore = useRelationsStore();
const userStore = useUserStore();

// Translations
const locales = {
	en: {
		click_to_add: 'Click to add files',
		add_files: 'Add Files',
		select_files: 'Select Files',
		delete_file: 'Delete file?',
		delete_all_files: 'Delete all files?',
		delete_all_count: '{count} files will be affected',
		cancel: 'Cancel',
		unlink: 'Unlink',
		unlink_all: 'Unlink All',
		delete: 'Delete',
		delete_all: 'Delete All',
		loading: 'Loading...',
		set_as_cover: 'Set as cover',
		remove_cover: 'Remove from cover',
		add_tag: 'Add tag...',
		drop_files: 'Drop files here',
		uploading_files: 'Uploading {current} of {total}...',
		edit_metadata: 'Edit metadata',
		edit_image: 'Edit image',
	},
	ru: {
		click_to_add: 'Нажмите для добавления файлов',
		add_files: 'Добавить файлы',
		select_files: 'Выбрать файлы',
		delete_file: 'Удалить файл?',
		delete_all_files: 'Удалить все файлы?',
		delete_all_count: 'Будет затронуто файлов: {count}',
		cancel: 'Отмена',
		unlink: 'Отвязать',
		unlink_all: 'Отвязать все',
		delete: 'Удалить',
		delete_all: 'Удалить все',
		loading: 'Загрузка...',
		set_as_cover: 'Сделать обложкой',
		remove_cover: 'Убрать с обложки',
		add_tag: 'Добавить тег...',
		drop_files: 'Перетащите файлы сюда',
		uploading_files: 'Загрузка {current} из {total}...',
		edit_metadata: 'Редактировать данные',
		edit_image: 'Редактировать изображение',
	},
};

const userLang = computed(() => {
	const directusLang = userStore.currentUser?.language;
	const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
	const lang = directusLang || browserLang || 'en-US';
	return lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
});

function t(key: string, params?: Record<string, any>): string {
	let text = locales[userLang.value]?.[key] || locales['en'][key] || key;
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			text = text.replace(`{${k}}`, String(v));
		});
	}
	return text;
}

// UID counter for stable keys
let uidCounter = 0;
function generateUid(): string {
	return `item-${++uidCounter}-${Date.now()}`;
}

// State
const loading = ref(false);
const uploadOpen = ref(false);
const fileEditorOpen = ref(false);
const editingFileId = ref<string | null>(null);
const editingFileIndex = ref<number | null>(null);
const fileItems = ref<any[]>([]);
const deleteDialogOpen = ref(false);
const deletingIndex = ref<number | null>(null);
const deletingItem = ref<any>(null);
const deletingAll = ref(false);
const activeTagPicker = ref<number | null>(null);
const customTagInput = ref('');
const isDraggingOver = ref(false);
const uploading = ref(false);
const uploadProgress = ref({ current: 0, total: 0 });
let dragCounter = 0;

// Computed
const uploadProgressPercent = computed(() => {
	if (uploadProgress.value.total === 0) return 0;
	return Math.round((uploadProgress.value.current / uploadProgress.value.total) * 100);
});

// Computed
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
		junctionField: junctionRelation.field,
		fileField: fileRelation?.field || 'directus_files_id',
	};
});

// Flag to skip watch when we just emitted
let skipNextWatch = false;

// Auto-set first item as cover if no cover exists
function ensureCoverExists(shouldEmit = false) {
	if (fileItems.value.length > 0) {
		const hasCover = fileItems.value.some(item => item.is_cover);
		if (!hasCover) {
			fileItems.value[0].is_cover = true;
			if (shouldEmit) {
				emitChanges();
			}
		}
	}
}

// Watch value and load files
watch(
	() => props.value,
	async (newValue) => {
		if (skipNextWatch) {
			skipNextWatch = false;
			return;
		}

		if (!relationInfo.value) return;
		const { junctionCollection, fileField } = relationInfo.value;

		if (!newValue || !Array.isArray(newValue) || newValue.length === 0) {
			fileItems.value = [];
			return;
		}

		// Get junction IDs (could be numbers or objects with id)
		const junctionIds = newValue
			.map(v => typeof v === 'object' && v !== null ? v.id : v)
			.filter(id => id && typeof id === 'number');

		// If we have junction IDs, fetch full data from server
		if (junctionIds.length > 0) {
			loading.value = true;
			try {
				const response = await api.get(`/items/${junctionCollection}`, {
					params: {
						filter: { id: { _in: junctionIds } },
						fields: ['*', `${fileField}.*`],
						limit: -1,
					},
				});

				const data = response.data?.data || [];

				// Map preserving order and is_cover from props.value
				// Priority: props.value > server data (props contains unsaved changes)
				fileItems.value = newValue.map(item => {
					const itemId = typeof item === 'object' && item !== null ? item.id : item;
					const hasIsCoverInProps = typeof item === 'object' && item !== null && 'is_cover' in item;
					const itemIsCover = hasIsCoverInProps ? item.is_cover : null;
					const hasTagsInProps = typeof item === 'object' && item !== null && 'tags' in item;
					const itemTags = hasTagsInProps ? item.tags : null;

					const found = data.find((d: any) => d.id === itemId);
					if (found) {
						return {
							$uid: generateUid(),
							...found,
							file: found[fileField],
							is_cover: itemIsCover !== null ? itemIsCover : (found.is_cover || false),
							tags: itemTags !== null ? itemTags : (found.tags || []),
						};
					}
					return null;
				}).filter(Boolean);

				ensureCoverExists(false);
			} catch (e) {
				console.error('Failed to load files:', e);
			} finally {
				loading.value = false;
			}
			return;
		}

		// No junction IDs - new unsaved items with file data
		fileItems.value = newValue.map(item => {
			if (typeof item !== 'object' || item === null) return null;

			const fileData = item[fileField];
			// Handle both object file data and string/null file IDs
			let file = null;
			if (typeof fileData === 'object' && fileData !== null) {
				file = fileData;
			} else if (typeof fileData === 'string') {
				// File is just an ID - create minimal file object
				file = { id: fileData };
			}

			return {
				$uid: generateUid(),
				...item,
				file,
				is_cover: item.is_cover || false,
				tags: item.tags || [],
			};
		}).filter(Boolean);

		ensureCoverExists(false);
	},
	{ immediate: true }
);

// Build emit value from fileItems
function buildEmitValue(): any[] | null {
	if (!relationInfo.value || fileItems.value.length === 0) return null;
	const { fileField } = relationInfo.value;

	return fileItems.value.map((item, index) => ({
		id: item.id,
		[fileField]: item.file?.id,
		sort: index + 1,
		is_cover: item.is_cover || false,
		tags: item.tags || [],
	}));
}

// Emit changes
function emitChanges() {
	skipNextWatch = true;
	emit('input', buildEmitValue());
}

// Drag & Drop from file system
function onDragEnter(e: DragEvent) {
	if (props.disabled) return;
	dragCounter++;
	if (e.dataTransfer?.types.includes('Files')) {
		isDraggingOver.value = true;
	}
}

function onDragOver(e: DragEvent) {
	if (props.disabled) return;
	e.dataTransfer!.dropEffect = 'copy';
}

function onDragLeave() {
	dragCounter--;
	if (dragCounter === 0) {
		isDraggingOver.value = false;
	}
}

async function onFileDrop(e: DragEvent) {
	dragCounter = 0;
	isDraggingOver.value = false;

	if (props.disabled || !e.dataTransfer?.files.length) return;

	const files = Array.from(e.dataTransfer.files);
	await uploadFiles(files);
}

async function uploadFiles(files: File[]) {
	if (!relationInfo.value) return;

	const { fileField } = relationInfo.value;
	const wasEmpty = fileItems.value.length === 0;
	let isFirst = true;

	// Start upload progress tracking
	uploading.value = true;
	uploadProgress.value = { current: 0, total: files.length };

	for (const file of files) {
		const formData = new FormData();
		formData.append('file', file);
		if (props.folder) {
			formData.append('folder', props.folder);
		}

		try {
			const response = await api.post('/files', formData);
			const uploadedFile = response.data.data;

			const newItem = {
				$uid: generateUid(),
				file: uploadedFile,
				[fileField]: uploadedFile,
				is_cover: wasEmpty && isFirst,
				tags: [],
			};

			fileItems.value = [...fileItems.value, newItem];
			isFirst = false;
		} catch (err) {
			console.error('Failed to upload file:', err);
		}

		// Update progress
		uploadProgress.value.current++;
	}

	// End upload progress tracking
	uploading.value = false;
	uploadProgress.value = { current: 0, total: 0 };

	emitChanges();
}

// Upload handlers
function openUpload() {
	if (!props.disabled) {
		uploadOpen.value = true;
	}
}

function onUpload(files: any | any[]) {
	if (!files || !relationInfo.value) return;

	const fileArray = Array.isArray(files) ? files : [files];
	const { fileField } = relationInfo.value;
	const wasEmpty = fileItems.value.length === 0;

	const newItems = fileArray.map((file, index) => {
		const fileObj = typeof file === 'object' ? file : { id: file };
		return {
			$uid: generateUid(),
			file: fileObj,
			[fileField]: fileObj,
			is_cover: wasEmpty && index === 0,
			tags: [],
		};
	});

	fileItems.value = [...fileItems.value, ...newItems];
	emitChanges();
	uploadOpen.value = false;
}

// Delete handlers
function removeItem(index: number) {
	deletingIndex.value = index;
	deletingItem.value = fileItems.value[index];
	deletingAll.value = false;
	deleteDialogOpen.value = true;
}

function removeAllItems() {
	deletingIndex.value = null;
	deletingItem.value = null;
	deletingAll.value = true;
	deleteDialogOpen.value = true;
}

function cancelDelete() {
	deleteDialogOpen.value = false;
	deletingIndex.value = null;
	deletingItem.value = null;
	deletingAll.value = false;
}

function confirmRemove() {
	if (deletingAll.value) {
		// Unlink all files (keep files in storage)
		fileItems.value = [];
		emitChanges();
		cancelDelete();
		return;
	}

	if (deletingIndex.value === null) {
		cancelDelete();
		return;
	}

	fileItems.value = fileItems.value.filter((_, i) => i !== deletingIndex.value);
	emitChanges();
	cancelDelete();
}

async function confirmDelete() {
	if (deletingAll.value) {
		// Delete all files from storage
		const fileIds = fileItems.value
			.map(item => item.file?.id)
			.filter(Boolean);

		fileItems.value = [];
		emitChanges();

		for (const fileId of fileIds) {
			try {
				await api.delete(`/files/${fileId}`);
			} catch (e) {
				console.error('Failed to delete file:', fileId, e);
			}
		}

		cancelDelete();
		return;
	}

	if (deletingIndex.value === null) {
		cancelDelete();
		return;
	}

	const fileId = deletingItem.value?.file?.id;
	fileItems.value = fileItems.value.filter((_, i) => i !== deletingIndex.value);
	emitChanges();

	if (fileId) {
		try {
			await api.delete(`/files/${fileId}`);
		} catch (e) {
			console.error('Failed to delete file:', e);
		}
	}

	cancelDelete();
}

// File editor handlers
function openFileEditor(item: any) {
	if (props.disabled || !item.file?.id) return;

	editingFileId.value = item.file.id;
	editingFileIndex.value = fileItems.value.indexOf(item);
	fileEditorOpen.value = true;
}

function openImageEditor(item: any) {
	if (props.disabled || !item.file?.id) return;

	// Open file detail page in new window where image editor is available
	const url = `/admin/files/${item.file.id}`;
	window.open(url, '_blank');
}

function closeFileEditor(active: boolean) {
	if (!active) {
		fileEditorOpen.value = false;
		editingFileId.value = null;
		editingFileIndex.value = null;
	}
}

function onFileUpdated(updatedFile: any) {
	if (editingFileIndex.value !== null && fileItems.value[editingFileIndex.value]) {
		const newItems = [...fileItems.value];
		newItems[editingFileIndex.value] = {
			...newItems[editingFileIndex.value],
			file: { ...newItems[editingFileIndex.value].file, ...updatedFile },
		};
		fileItems.value = newItems;
	}
	closeFileEditor(false);
}

// Sort handler
function onSortEnd() {
	emitChanges();
}

// Cover toggle handler
function toggleCover(index: number) {
	if (!relationInfo.value) return;

	fileItems.value = fileItems.value.map((item, i) => ({
		...item,
		is_cover: i === index ? !item.is_cover : false,
	}));

	emitChanges();
}

// Tag handlers
function openTagPicker(index: number) {
	if (props.disabled) return;
	activeTagPicker.value = activeTagPicker.value === index ? null : index;
	customTagInput.value = '';
}

function closeTagPicker() {
	activeTagPicker.value = null;
	customTagInput.value = '';
}

function toggleTag(index: number, tag: string) {
	const item = fileItems.value[index];
	if (!item) return;

	const currentTags = item.tags || [];
	const tagIndex = currentTags.indexOf(tag);

	if (tagIndex === -1) {
		// Add tag
		fileItems.value[index] = {
			...item,
			tags: [...currentTags, tag],
		};
	} else {
		// Remove tag
		fileItems.value[index] = {
			...item,
			tags: currentTags.filter((t: string) => t !== tag),
		};
	}

	emitChanges();
}

function addCustomTag(index: number) {
	const tag = customTagInput.value.trim();
	if (!tag) return;

	const item = fileItems.value[index];
	if (!item) return;

	const currentTags = item.tags || [];
	if (!currentTags.includes(tag)) {
		fileItems.value[index] = {
			...item,
			tags: [...currentTags, tag],
		};
		emitChanges();
	}

	customTagInput.value = '';
}

function removeTag(index: number, tag: string) {
	const item = fileItems.value[index];
	if (!item) return;

	const currentTags = item.tags || [];
	fileItems.value[index] = {
		...item,
		tags: currentTags.filter((t: string) => t !== tag),
	};

	emitChanges();
}
</script>

<style scoped>
.gallery-grid {
	width: 100%;
	position: relative;
}

.gallery-grid.drag-over {
	outline: 2px dashed var(--theme--primary);
	outline-offset: -2px;
	border-radius: var(--theme--border-radius);
}

.drop-overlay {
	position: absolute;
	inset: 0;
	background: var(--theme--primary-background);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	z-index: 100;
	border-radius: var(--theme--border-radius);
	color: var(--theme--primary);
	font-weight: 500;
}

.upload-overlay {
	position: absolute;
	inset: 0;
	background: var(--theme--background);
	opacity: 0.95;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	z-index: 100;
	border-radius: var(--theme--border-radius);
	padding: 20px;
}

.upload-status {
	display: flex;
	align-items: center;
	gap: 12px;
	color: var(--theme--primary);
	font-weight: 500;
}

.upload-overlay .v-progress-linear {
	width: 100%;
	max-width: 300px;
}

.grid {
	display: grid;
	grid-template-columns: repeat(var(--columns, 4), 1fr);
	gap: 12px;
}

.grid-item {
	position: relative;
	background: var(--theme--background-normal);
	border: 1px solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
	cursor: grab;
}

.grid-item:active {
	cursor: grabbing;
}

.grid-item:hover {
	border-color: var(--theme--primary);
}

.grid-item.is-cover {
	border-color: var(--theme--warning);
	box-shadow: 0 0 0 2px var(--theme--warning);
}

.grid-item.is-loading {
	opacity: 0.7;
}

.grid-item.ghost {
	opacity: 0.5;
	background: var(--theme--primary-subdued);
}

.preview {
	position: relative;
	aspect-ratio: 1;
	background: var(--theme--background-subdued);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	overflow: hidden;
	border-radius: var(--theme--border-radius) var(--theme--border-radius) 0 0;
}

.preview :deep(img) {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.preview-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	opacity: 0;
	transition: opacity 0.2s;
	color: white;
}

.preview:hover .preview-overlay {
	opacity: 1;
}

.preview-action {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: var(--theme--background);
	color: var(--theme--foreground);
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.15s, transform 0.15s;
}

.preview-action:hover {
	background: var(--theme--primary);
	color: white;
	transform: scale(1.1);
}

.file-placeholder {
	color: var(--theme--foreground-subdued);
}

.file-placeholder.loading {
	display: flex;
	align-items: center;
	justify-content: center;
}

.info {
	padding: 8px;
	border-top: 1px solid var(--theme--border-color-subdued);
	border-radius: 0 0 var(--theme--border-radius) var(--theme--border-radius);
}

.title {
	display: block;
	font-size: 12px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--theme--foreground);
}

.remove-btn {
	position: absolute;
	top: 4px;
	right: 4px;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--theme--danger);
	color: white;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0;
	transition: opacity 0.2s;
}

.grid-item:hover .remove-btn {
	opacity: 1;
}

.cover-btn {
	position: absolute;
	top: 4px;
	left: 4px;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: var(--theme--background);
	color: var(--theme--foreground-subdued);
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0.7;
	transition: all 0.2s;
	z-index: 5;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.grid-item:hover .cover-btn {
	opacity: 1;
}

.cover-btn:hover {
	background: var(--theme--warning);
	color: white;
}

.cover-btn.active {
	opacity: 1;
	background: var(--theme--warning);
	color: white;
}

.empty {
	border: 2px dashed var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	padding: 40px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: var(--theme--foreground-subdued);
	cursor: pointer;
	transition: all 0.2s;
}

.empty:hover {
	border-color: var(--theme--primary);
	color: var(--theme--primary);
}

.action-buttons {
	display: flex;
	gap: 8px;
	margin-top: 12px;
}

.upload-content {
	padding: 20px;
}

.v-card-title {
	font-size: 18px;
	font-weight: 600;
	padding: 20px 20px 8px;
}

.v-card-text {
	color: var(--theme--foreground-subdued);
	padding: 0 20px;
}

.v-card-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	justify-content: flex-end;
	padding: 20px;
}

.v-card-actions .v-button {
	flex-shrink: 0;
}

/* Tags styles */
.tags-row {
	position: relative;
	padding: 8px;
	border-top: 1px solid var(--theme--border-color-subdued);
	min-height: 36px;
}

.tags-list {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.tag-chip {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 4px 10px;
	background: var(--theme--primary-background);
	color: var(--theme--primary);
	border-radius: 12px;
	font-size: 12px;
	cursor: pointer;
	transition: all 0.15s;
}

.tag-chip:hover {
	background: var(--theme--primary-subdued);
}

.tag-chip .tag-remove {
	opacity: 0;
	margin-left: 2px;
	transition: opacity 0.15s;
}

.tag-chip:hover .tag-remove {
	opacity: 1;
}

.add-tag-btn {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--theme--background-normal);
	border: 1px dashed var(--theme--border-color);
	color: var(--theme--foreground-subdued);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s;
}

.add-tag-btn:hover,
.add-tag-btn.active {
	background: var(--theme--primary-background);
	border-color: var(--theme--primary);
	color: var(--theme--primary);
}

.tag-picker {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	background: var(--theme--background);
	border: 1px solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	z-index: 100;
	padding: 10px;
}

.quick-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 10px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--theme--border-color-subdued);
}

.quick-tag {
	display: inline-flex;
	align-items: center;
	padding: 4px 10px;
	background: var(--theme--background-normal);
	color: var(--theme--foreground);
	border-radius: 12px;
	font-size: 12px;
	cursor: pointer;
	transition: all 0.15s;
}

.quick-tag:hover {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
}

.quick-tag.selected {
	background: var(--theme--primary);
	color: white;
}

.custom-tag-input {
	display: flex;
	gap: 4px;
}

.custom-tag-input input {
	flex: 1;
	padding: 6px 10px;
	border: 1px solid var(--theme--border-color);
	border-radius: var(--theme--border-radius);
	background: var(--theme--background);
	color: var(--theme--foreground);
	font-size: 12px;
	outline: none;
}

.custom-tag-input input:focus {
	border-color: var(--theme--primary);
}

.custom-tag-input button {
	width: 28px;
	height: 28px;
	border-radius: var(--theme--border-radius);
	background: var(--theme--primary);
	color: white;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s;
}

.custom-tag-input button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.custom-tag-input button:not(:disabled):hover {
	background: var(--theme--primary-accent);
}
</style>
