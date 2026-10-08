import process from 'node:process';
import { test, expect } from '@playwright/test';
test('login → create → attribute rule → evaluate → history → logout', async ({
  page,
}) => {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Use pnpm test:e2e for isolated credentials');
  await page.goto('/');
  await page.getByLabel('账号', { exact: true }).fill('e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '功能配置' })).toBeVisible();
  await page.getByRole('button', { name: '新建 Flag', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Checkout smoke');
  await page.getByLabel('Key', { exact: true }).fill('checkout-smoke');
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Checkout smoke' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '添加规则', exact: true }).click();
  await page.getByLabel('属性名称', { exact: true }).fill('country');
  await page.getByLabel('期望值 JSON', { exact: true }).fill('"cn"');
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await expect(page.getByText('命中返回')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Checkout smoke' }),
  ).toBeVisible();
  await expect(page.getByText('country', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '运行评估', exact: true }).click();
  await page
    .getByLabel('用户属性 JSON', { exact: true })
    .fill('{"country":"cn"}');
  await page.getByRole('button', { name: '运行评估', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('true');
  await expect(page.getByRole('status')).toContainText('属性规则命中');
  await expect(page.getByRole('status')).toContainText('revision 2');
  await expect(
    page.getByRole('button', { name: '运行评估', exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: '../test-results/d2-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: '切换为深色主题', exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  await page.screenshot({
    path: '../test-results/d2-dark-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: '功能配置', exact: true }).click();
  await page.getByRole('link', { name: 'Checkout smoke', exact: true }).click();
  await page.getByRole('button', { name: '操作历史', exact: true }).click();
  await expect(page.getByText('添加规则', { exact: true })).toBeVisible();
  await expect(page.getByText('创建配置', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
});
