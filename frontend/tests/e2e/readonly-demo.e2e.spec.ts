import process from 'node:process';
import { test, expect } from '@playwright/test';

test('viewer reads seeded rules, evaluates, views history and logs out; editor sees production readonly', async ({
  page,
}, testInfo) => {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Use pnpm test:e2e for isolated credentials');
  await page.goto('/');
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.E2E_VIEWER_USERNAME ?? 'e2e-viewer');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '功能配置' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '新建 Flag', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: '演示：结账灰度', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '演示：结账灰度' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '停用配置', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '添加规则', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('当前环境为只读；可以查看配置和运行评估。'),
  ).toBeVisible();
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await page.getByRole('combobox', { name: '选择版本', exact: true }).click();
  await page.getByRole('option', { name: /^r1 ·/, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '选中版本的完整配置' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '操作历史', exact: true }).click();
  await expect(page.getByText('创建配置', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('listitem')
      .filter({ has: page.getByText('创建配置', { exact: true }) }),
  ).toContainText(process.env.E2E_ADMIN_NAME ?? 'E2E 管理员');
  await page.getByRole('link', { name: '运行评估', exact: true }).click();
  await page
    .getByLabel('用户属性 JSON', { exact: true })
    .fill('{"tier":"blocked","country":"CN","user_id":"alice"}');
  await page.getByRole('button', { name: '运行评估', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('false');
  await expect(page.getByRole('status')).toContainText('属性规则命中');
  await expect(page.getByRole('status')).toContainText('revision 1');
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();

  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.E2E_EDITOR_USERNAME ?? 'e2e-editor');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('link', { name: '功能配置', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '新建 Flag', exact: true }),
  ).toBeEnabled();
  await page.getByRole('combobox', { name: '当前环境', exact: true }).click();
  await page.getByRole('option', { name: 'Production', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '新建 Flag', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('link', { name: '演示：结账生产基线', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '停用配置', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '添加规则', exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('d5-production-readonly.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
});
