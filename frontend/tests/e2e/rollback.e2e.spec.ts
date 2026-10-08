import process from 'node:process';
import { test, expect } from '@playwright/test';
test('percentage rule → edit → version preview → rollback → evaluate restored revision', async ({
  page,
}, testInfo) => {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Use pnpm test:e2e');
  await page.goto('/');
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.E2E_ADMIN_USERNAME ?? 'e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('密码', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: '功能配置' })).toBeVisible();
  await page.getByRole('button', { name: '新建 Flag', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Percentage rollback');
  await page.getByLabel('Key', { exact: true }).fill('percentage-rollback');
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Percentage rollback' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '添加规则', exact: true }).click();
  await page.getByLabel('规则类型', { exact: true }).selectOption('percentage');
  await page.getByLabel('用户比例 (%)', { exact: true }).fill('100');
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑规则', exact: true }).click();
  await page.getByLabel('用户比例 (%)', { exact: true }).fill('0');
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '运行评估', exact: true }).click();
  await page
    .getByLabel('用户属性 JSON', { exact: true })
    .fill('{"user_id":"stable-user"}');
  await page.getByRole('button', { name: '运行评估', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('false');
  await expect(page.getByRole('status')).toContainText('revision 3');
  await page.getByRole('link', { name: '功能配置', exact: true }).click();
  await page
    .getByRole('link', { name: 'Percentage rollback', exact: true })
    .click();
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await page.getByLabel('选择版本', { exact: true }).selectOption('2');
  await expect(
    page.getByRole('heading', { name: '选中版本的完整配置' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '规则及顺序' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('d3-version-diff.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '切换为深色主题' }).click();
  await page.screenshot({
    path: testInfo.outputPath('d3-version-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('d3-version-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: '切换为浅色主题' }).click();
  await page.getByRole('button', { name: '回滚到 r2', exact: true }).click();
  await page.getByRole('button', { name: '确认回滚', exact: true }).focus();
  await page
    .getByRole('button', { name: '确认回滚', exact: true })
    .press('Enter');
  await expect(page.getByRole('status')).toContainText('revision 4');
  await expect(page.getByLabel('选择版本')).toContainText('r3');
  await expect(page.getByLabel('选择版本')).toContainText('r4');
  await page.getByRole('link', { name: '运行评估', exact: true }).click();
  await page
    .getByLabel('用户属性 JSON', { exact: true })
    .fill('{"user_id":"stable-user"}');
  await page.getByRole('button', { name: '运行评估', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('true');
  await expect(page.getByRole('status')).toContainText('百分比规则命中');
  await expect(page.getByRole('status')).toContainText('revision 4');
});
