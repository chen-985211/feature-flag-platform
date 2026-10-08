import process from 'node:process';
import { test, expect } from '@playwright/test';
test('reorder → copy → fixed source publication → target evaluation and audit', async ({
  page,
}) => {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Use pnpm test:e2e');
  await page.goto('/');
  await page.getByLabel('账号', { exact: true }).fill('e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '新建 Flag', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('Environment flow');
  await page.getByLabel('Key', { exact: true }).fill('environment-flow');
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await page.getByRole('button', { name: '添加规则', exact: true }).click();
  await page.getByLabel('属性名称', { exact: true }).fill('country');
  await page.getByLabel('期望值 JSON', { exact: true }).fill('"cn"');
  await page.getByLabel('命中返回 true', { exact: true }).uncheck();
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await page.getByRole('button', { name: '添加规则', exact: true }).click();
  await page.getByLabel('规则类型', { exact: true }).selectOption('percentage');
  await page.getByLabel('用户比例 (%)', { exact: true }).fill('100');
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await page.getByRole('button', { name: '调整规则顺序', exact: true }).click();
  const order = page.getByRole('list', { name: '规则排序' });
  await order.scrollIntoViewIfNeeded();
  const from = await order.getByRole('listitem').nth(1).boundingBox();
  const to = await order.getByRole('listitem').nth(0).boundingBox();
  if (!from || !to) throw new Error('Sorting rows must be visible');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  // Native dragover needs a second mouse move; keep the intended drop slot.
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2);
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('顺序已保存');
  await expect(page.getByText('development · revision 4')).toBeVisible();
  await page.getByRole('button', { name: '环境流转', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '环境流转' });
  await expect(
    dialog.getByRole('button', { name: '关闭环境流转' }),
  ).toBeFocused();
  await expect(dialog.getByRole('button', { name: '确认复制' })).toBeEnabled();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: '取消', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: '关闭环境流转' }),
  ).toBeFocused();
  await page.screenshot({
    path: '../test-results/d4-copy-light.png',
    fullPage: true,
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: '确认复制' }).click();
  await expect(dialog.getByRole('status')).toContainText('目标 revision 1');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: '环境流转', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: '编辑规则', exact: true })
    .first()
    .click();
  await page.getByLabel('命中返回 true', { exact: true }).uncheck();
  await page.getByRole('button', { name: '保存规则', exact: true }).click();
  await expect(page.getByText('development · revision 5')).toBeVisible();
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await page.getByRole('button', { name: '编辑基本信息' }).click();
  await page.getByLabel('名称', { exact: true }).fill('Future source');
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Future source', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('development · revision 6')).toBeVisible();
  await page.getByRole('button', { name: '切换为深色主题' }).click();
  await page.getByRole('button', { name: '环境流转', exact: true }).click();
  await dialog.getByLabel('源版本', { exact: true }).selectOption('5');
  await dialog.getByLabel('操作方式', { exact: true }).selectOption('publish');
  await expect(dialog.getByRole('heading', { name: '发布差异' })).toBeVisible();
  await expect(dialog.getByText(/当前 r1/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: '确认发布' })).toBeEnabled();
  await dialog
    .getByRole('heading', { name: '发布差异' })
    .scrollIntoViewIfNeeded();
  await dialog.locator('.transfer-body').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.screenshot({
    path: '../test-results/d4-publication-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole('heading', { name: '发布差异' })
    .scrollIntoViewIfNeeded();
  await dialog.locator('.transfer-body').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.screenshot({
    path: '../test-results/d4-publication-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: '确认发布' }).click();
  await expect(dialog.getByRole('status')).toContainText('目标 revision 2');
  await dialog.getByRole('link', { name: '查看目标配置' }).click();
  await expect(
    page.getByRole('heading', { name: 'Environment flow', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('staging · revision 2')).toBeVisible();
  await page.getByRole('link', { name: '运行评估', exact: true }).click();
  await page
    .getByLabel('用户属性 JSON', { exact: true })
    .fill('{"user_id":"stable-user","country":"cn"}');
  await page.getByRole('button', { name: '运行评估', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('false');
  await expect(page.getByRole('status')).toContainText('百分比规则命中');
  await expect(page.getByRole('status')).toContainText('revision 2');
  await page.getByRole('link', { name: '功能配置', exact: true }).click();
  await page
    .getByRole('link', { name: 'Environment flow', exact: true })
    .click();
  await page.getByRole('button', { name: '操作历史', exact: true }).click();
  await expect(page.getByText('复制配置', { exact: true })).toBeVisible();
  const entry = page
    .getByRole('listitem')
    .filter({ has: page.getByText('发布配置', { exact: true }) });
  await entry.getByText('查看变更详情', { exact: true }).click();
  await expect(entry).toContainText('"source"');
  await expect(entry).toContainText(/"revision":\s*5/);
  await expect(entry).toContainText('E2E 管理员');
});
