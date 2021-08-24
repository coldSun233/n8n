import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	get,
	isEqual,
	isObject,
	lt,
	merge,
	reduce,
	set,
	unset,
} from 'lodash';

const {
	NodeVM,
} = require('vm2');

export class ItemLists implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Item lists',
		name: 'itemLists',
		icon: 'file:itemLists.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Helpers for working with lists of items',
		defaults: {
			name: 'Item lists',
			color: '#ff6d5a',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Item List',
						value: 'itemList',
					},
				],
				default: 'itemList',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Split Out Items',
						value: 'splitOutItems',
						description: 'Turn a list inside item(s) into separate items',
					},
					{
						name: 'Aggregate Items',
						value: 'aggregateItems',
						description: 'Merge fields into a single new item',
					},
					{
						name: 'Remove Duplicates',
						value: 'removeDuplicates',
						description: 'Remove extra items that are similar',
					},
					{
						name: 'Sort',
						value: 'sort',
						description: 'Change the item order',
					},
					{
						name: 'Limit',
						value: 'limit',
						description: 'Remove items if there are too many',
					},
				],
				default: 'splitOutItems',
			},
			// Split out items - Fields
			{
				displayName: 'Field To Split By',
				name: 'fieldToSplitBy',
				type: 'string',
				default: '',
				required: true,
				description: 'The field to break out into separate items',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'splitOutItems',
						],
					},
				},
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'options',
				options: [
					{
						name: 'All Other Fields',
						value: 'allOtherFields',
					},
					{
						name: 'No Other Fields',
						value: 'noOtherFields',
					},
					{
						name: 'Selected Other Fields',
						value: 'selectedOtherFields',
					},
				],
				default: '',
				description: 'Whether to copy any other fields into the new items',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'splitOutItems',
						],
					},
				},
			},
			{
				displayName: 'Fields To Include',
				name: 'fieldsToInclude',
				type: 'string',
				default: '',
				required: true,
				description: 'A list of input field names to copy over to the new items, separated by commas',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'splitOutItems',
						],
						include: [
							'selectedOtherFields',
						],
					},
				},
			},
			{
				displayName: 'Fields To Aggregate',
				name: 'fieldsToAggregate',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Field To Aggregate',
				default: {},
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'aggregateItems',
						],
					},
				},
				options: [
					{
						displayName: 'Field To Aggregate',
						name: 'fieldToAggregate',
						values: [
							{
								displayName: 'Field To Aggregate',
								name: 'fieldToAggregate',
								type: 'string',
								default: '',
								description: 'A field in the input items to aggregate together',
							},
							{
								displayName: 'Output Field Name',
								name: 'outputFieldName',
								type: 'string',
								default: 'data',
								description: 'The name of the field to put the aggregated data in',
							},
						],
					},
				],
			},

			// Remove duplicates - Fields
			{
				displayName: 'Compare',
				name: 'compare',
				type: 'options',
				options: [
					{
						name: 'All Fields',
						value: 'allFields',
					},
					{
						name: 'All Fields Except',
						value: 'allFieldsExcept',
					},
					{
						name: 'Selected Fields',
						value: 'selectedFields',
					},
				],
				default: 'allFields',
				description: 'The fields of the input items to compare to see if they are the same',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'removeDuplicates',
						],
					},
				},
			},
			{
				displayName: 'Fields To Exclude',
				name: 'fieldsToExclude',
				type: 'string',
				default: '',
				description: 'A list of input field names to exclude from the comparison, separated by commas. You can use dot notation to drill down, e.g. parent_field.child_field',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'removeDuplicates',
						],
						compare: [
							'allFieldsExcept',
						],
					},
				},
			},
			{
				displayName: 'Fields To Compare',
				name: 'fieldsToCompare',
				type: 'string',
				default: '',
				description: 'A list of input field names to compare on, separated by commas. You can use dot notation to drill down, e.g. parent_field.child_field',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'removeDuplicates',
						],
						compare: [
							'selectedFields',
						],
					},
				},
			},
			// Sort - Fields
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'Code',
						value: 'code',
					},
					{
						name: 'Simple',
						value: 'simple',
					},
				],
				default: 'simple',
				description: 'The fields of the input items to compare to see if they are the same',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'sort',
						],
					},
				},
			},
			{
				displayName: 'Fields To Sort By',
				name: 'sortFieldsUi',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Field To Sort By',
				options: [
					{
						displayName: 'Sort Field',
						name: 'sortField',
						values: [
							{
								displayName: 'Field Name',
								name: 'fieldName',
								type: 'string',
								required: true,
								default: '',
								description: 'The field to sort by',
							},
							{
								displayName: 'Order',
								name: 'order',
								type: 'options',
								options: [
									{
										name: 'Ascending',
										value: 'ascending',
									},
									{
										name: 'Descending',
										value: 'descending',
									},
								],
								default: 'ascending',
								description: 'The order to sort by',
							},
						],
					},
				],
				default: {},
				description: 'The fields of the input items to compare to see if they are the same',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'sort',
						],
						type: [
							'simple',
						],
					},
				},
			},
			{
				displayName: 'Code',
				name: 'code',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
					editor: 'code',
					rows: 10,
				},
				default: `// The two items to compare are in the variables a and b
// Access the fields in a.json and b.json
// Return -1 if a should go before b
// Return 1 if b should go before a
// Return 0 if there's no difference

if (a.json.fieldName < b.json.fieldName) {
		return -1;
}
if (a.json.fieldName > b.json.fieldName) {
		return 1;
}
return 0;`,
				description: 'Javascript code to determine the order of any two items',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'sort',
						],
						type: [
							'code',
						],
					},
				},
			},
			// Limit - Fields
			{
				displayName: 'Max Items',
				name: 'maxItems',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'If there are more items than this number, some are removed',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'limit',
						],
					},
				},
			},
			{
				displayName: 'Keep',
				name: 'keep',
				type: 'options',
				options: [
					{
						name: 'First Items',
						value: 'firstItems',
					},
					{
						name: 'Last Items',
						value: 'lastItems',
					},
				],
				default: 'firstItems',
				description: 'When removing items, whether to keep the ones at the start or the ending',
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'limit',
						],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'removeDuplicates',
						],
					},
				},
				options: [
					{
						displayName: 'Allow Dot Notation',
						name: 'allowDotNotation',
						type: 'boolean',
						displayOptions: {
							show: {
								'/compare': [
									'allFieldsExcept',
									'selectedFields',
								],
							},
						},
						default: false,
						description: 'Whether to allow referencing child fields using `parent.child` in the field name',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [
							'itemList',
						],
						operation: [
							'splitOutItems',
							'aggregateItems',
						],
					},
				},
				options: [
					{
						displayName: 'Allow Dot Notation',
						name: 'allowDotNotation',
						type: 'boolean',
						displayOptions: {
							show: {
								'/operation': [
									'splitOutItems',
									'aggregateItems',
								],
							},
						},
						default: false,
						description: 'Whether to allow referencing child fields using `parent.child` in the field name',
					},
					{
						displayName: 'Destination Field Name',
						name: 'destinationFieldName',
						type: 'string',
						displayOptions: {
							show: {
								'/operation': [
									'splitOutItems',
								],
							},
						},
						default: '',
						description: 'The field in the output to put the split field contents under',
					},
				],
			},
		],
	};
	// TODO: change the errors
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const length = (items.length as unknown) as number;
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		if (resource === 'itemList') {
			if (operation === 'splitOutItems') {

				for (let i = 0; i < length; i++) {
					const fieldToSplitBy = this.getNodeParameter('fieldToSplitBy', i) as string;

					const allowDotNotation = this.getNodeParameter('options.allowDotNotation', 0, false) as boolean;
					const destinationFieldName = this.getNodeParameter('options.destinationFieldName', i, '') as string;
					const include = this.getNodeParameter('include', i) as string;
					let arrayToSplit;
					if (allowDotNotation) {
						arrayToSplit = get(items[i].json, fieldToSplitBy);
					} else {
						arrayToSplit = items[i].json[fieldToSplitBy as string];
					}
					if (!Array.isArray(arrayToSplit)) {
						throw new NodeOperationError(this.getNode(), `The provided field "${fieldToSplitBy}" is not an array`);
					} else {

						for (const element of arrayToSplit) {

							let newItem = {};

							if (typeof element === 'object' && include === 'noOtherFields') {
								newItem = { ...element };
							} else {
								newItem = { [destinationFieldName as string || fieldToSplitBy as string]: element };
							}

							// let newItem = {
							// 	...(typeof element === 'object') ? element : { [fieldToSplitBy as string]: element },
							// };

							if (include === 'selectedOtherFields') {

								const fieldsToInclude = (this.getNodeParameter('fieldsToInclude', i) as string).split(',');
								newItem = {
									...newItem,
									...fieldsToInclude.reduce((prev, field) => {
										if (field === fieldToSplitBy) {
											return prev;
										}
										let value;
										if (allowDotNotation) {
											value = get(items[i].json, field);
										} else {
											value = items[i].json[field as string];
										}
										prev = { ...prev, [field as string]: value, };
										return prev;
									}, {}),
								};

							} else if (include === 'allOtherFields') {

								let keys;
								if (allowDotNotation) {
									keys = Object.keys(flattenKeys(items[i].json));
									
								} else {
									keys = Object.keys(items[i].json);
								}

								newItem = {
									...newItem,
									...keys.reduce((prev, field) => {

										if (field.startsWith(fieldToSplitBy)) {
											return prev;
										}
										let value;
										if (allowDotNotation) {
											value = get(items[i].json, field);
										} else {
											value = items[i].json[field as string];
										}
										prev = { ...prev, [field as string]: value, };
										return prev;
									}, {}),
								};

							}
							returnData.push({ json: newItem });
						}
					}
				}

				return this.prepareOutputData(returnData);

			} else if (operation === 'aggregateItems') {

				const allowDotNotation = this.getNodeParameter('options.allowDotNotation', 0, false) as boolean;
				const fieldsToAggregate = this.getNodeParameter('fieldsToAggregate.fieldToAggregate', 0) as [{ fieldToAggregate: string, outputFieldName: string }];

				if (!fieldsToAggregate.length) {
					throw new NodeOperationError(this.getNode(), 'No fields specified. Please add a field to aggregate');
				}

				let newItem: INodeExecutionData;
				newItem = { json: {} };
				// tslint:disable-next-line: no-any
				const values: { [key: string]: any } = {};

				for (const { fieldToAggregate, outputFieldName } of fieldsToAggregate) {
					if (fieldToAggregate !== '') {
						values[outputFieldName] = [];
						for (let i = 0; i < length; i++) {
							if (allowDotNotation) {
								if (get(items[i].json, fieldToAggregate) !== undefined) {
									values[outputFieldName].push(get(items[i].json, fieldToAggregate));
								}
							} else {
								if (items[i].json[fieldToAggregate] !== undefined) {
									values[outputFieldName].push(items[i].json[fieldToAggregate]);
								}
							}
						}
					}
				}

				for (const key of Object.keys(values)) {
					if (allowDotNotation) {
						set(newItem.json, key, values[key]);
					} else {
						newItem.json[key] = values[key];
					}
				}

				returnData.push(newItem);

				return this.prepareOutputData(returnData);

			} else if (operation === 'removeDuplicates') {

				const compare = this.getNodeParameter('compare', 0) as string;
				const allowDotNotation = this.getNodeParameter('options.allowDotNotation', 0, false) as boolean;
				let keys = Object.keys(items[0].json);

				if (compare === 'allFieldsExcept') {
					const fieldsToExclude = (this.getNodeParameter('fieldsToExclude', 0) as string).split(',');
					if (allowDotNotation) {
						keys = Object.keys(flattenKeys(items[0].json));
					}
					keys = keys.filter(key => !fieldsToExclude.includes(key));
				} if (compare === 'selectedFields') {
					const fieldsToCompare = (this.getNodeParameter('fieldsToCompare', 0) as string).split(',');
					if (fieldsToCompare.length === 0) {
						throw new NodeOperationError(this.getNode(), 'No fields specified. Please add a field to compare on');
					}
					if (allowDotNotation) {
						keys = Object.keys(flattenKeys(items[0].json));
					}
					keys = fieldsToCompare.map(key => (key.trim()));
				}
				// This solution is O(nlogn)
				// add original index to the items
				const newItems = items.map((item, index) => ({ json: { ...item['json'], INDEX: index, }, } as INodeExecutionData));
				// sort items using the compare keys				
				newItems.sort((a, b) => {
					let result = 0;

					for (const key of keys) {
						let equal;
						if (allowDotNotation) {
							equal = isEqual(get(a.json, key), get(b.json, key));
						} else {
							equal = isEqual(a.json[key], b.json[key]);
						}
						if (!equal) {
							let lessThan;
							if (allowDotNotation) {
								lessThan = lt(get(a.json, key), get(b.json, key));
							} else {
								lessThan = lt(a.json[key], b.json[key]);
							}
							result = lessThan ? -1 : 1;
							break;
						}
					}
					return result;
				});
				// collect the original indexes of items to be removed
				const removedIndexes: number[] = [];
				let temp = newItems[0];
				for (let index = 1; index < newItems.length; index++) {
					if (compareItems(newItems[index], temp, keys, allowDotNotation)) {
						removedIndexes.push(newItems[index].json.INDEX as unknown as number);
					} else {
						temp = newItems[index];
					}
				}
				// return the filtered items
				return this.prepareOutputData(items.filter((_, index) => !removedIndexes.includes(index)));

			} else if (operation === 'sort') {

				let newItems = [...items];
				const type = this.getNodeParameter('type', 0) as string;

				if (type === 'simple') {
					const sortFieldsUi = this.getNodeParameter('sortFieldsUi', 0) as IDataObject;
					const sortFields = sortFieldsUi.sortField as Array<{
						fieldName: string;
						order: 'ascending' | 'descending'
					}>;

					if (!sortFields.length) {
						throw new NodeOperationError(this.getNode(), 'No sorting specified. Please add a field to sort by');
					}

					const sortFieldsWithDirection = sortFields.map(field => ({ name: field.fieldName, dir: field.order === 'ascending' ? 1 : -1 }));

					newItems.sort((a, b) => {
						let result = 0;

						for (const field of sortFieldsWithDirection) {
							const equal = isEqual(a.json[field.name as string], b.json[field.name as string]);
							if (!equal) {
								const lessThan = lt(a.json[field.name as string], b.json[field.name as string]);
								if (lessThan) {
									result = -1 * field.dir;
								} else {
									result = 1 * field.dir;
								}
								break;
							}
						}
						return result;
					});
				} else {
					const code = this.getNodeParameter('code', 0) as string;
					const regexCheck = /\breturn\b/g.exec(code);

					if (regexCheck && regexCheck.length) {

						const sandbox = {
							newItems,
						};
						const mode = this.getMode();
						const options = {
							console: (mode === 'manual') ? 'redirect' : 'inherit',
							sandbox,
						};
						const vm = new NodeVM(options);

						newItems = (await vm.run(`
						module.exports = async function() {
							newItems.sort( (a,b) => {
								${code}
							})
							return newItems;
						}()`, __dirname));

					} else {
						throw new NodeOperationError(this.getNode(), `Sort code doesn't return. Please add a 'return' statement to your code`);
					}
				}
				return this.prepareOutputData(newItems);

			} else if (operation === 'limit') {

				let newItems = items;
				const maxItems = this.getNodeParameter('maxItems', 0) as number;
				const keep = this.getNodeParameter('keep', 0) as string;

				if (maxItems > items.length) {
					throw new NodeOperationError(this.getNode(), 'The provided max items number is larger than the input items number');
				}

				if (keep === 'firstItems') {
					newItems = items.slice(0, maxItems);
				} else {
					newItems = items.slice(items.length - maxItems, items.length);
				}
				return this.prepareOutputData(newItems);

			} else {
				throw new NodeOperationError(this.getNode(), `Operation "${operation}" is not recognized`);
			}
		} else {
			throw new NodeOperationError(this.getNode(), `Resource "${resource}" is not recognized`);
		}
	}
}

const compareItems = (obj: INodeExecutionData, obj2: INodeExecutionData, keys: string[], allowDotNotation: boolean) => {
	let result = true;
	const keys1 = allowDotNotation ? Object.keys(flattenKeys(obj.json)) : Object.keys(obj.json);
	const keys2 = allowDotNotation ? Object.keys(flattenKeys(obj2.json)) : Object.keys(obj2.json);
	for (const key of keys) {

		if (!keys1.includes(key) || !keys2.includes(key)) {
			throw new Error(`Key "${key}" does not exist in one of the input items`);
		}
		if (allowDotNotation) {
			if (!isEqual(get(obj.json, key), get(obj2.json, key))) {
				result = false;
				break;
			}
		} else {
			if (!isEqual(obj.json[key as string], obj2.json[key as string])) {
				result = false;
				break;
			}
		}
	}
	return result;
};

const flattenKeys = (obj: {}, path: string[] = []): {} => {
	return !isObject(obj)
		? { [path.join('.')]: obj }
		: reduce(obj, (cum, next, key) => merge(cum, flattenKeys(next, [...path, key])), {});
};
