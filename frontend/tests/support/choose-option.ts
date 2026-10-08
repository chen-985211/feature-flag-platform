import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
export async function chooseOption(label: string, option: string | RegExp) {
  await userEvent.click(await screen.findByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}
