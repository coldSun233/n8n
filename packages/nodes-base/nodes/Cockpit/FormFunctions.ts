import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions
} from 'n8n-core';
import { IDataObject } from 'n8n-workflow';
import { IForm } from './FormInterface';
import { cockpitApiRequest } from './GenericFunctions';

export async function submitForm(this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions, resourceName: string, form: IDataObject) {
	const body: IForm = {
		form: JSON.parse(form.toString())
	};

	return cockpitApiRequest.call(this, 'post', `/forms/submit/${resourceName}`, body);
}
