import process from 'node:process';
import { test, expect, type Page } from '@playwright/test';

async function expectNavigationRow(
  page: Page,
  label: string,
  { mobile = false, iconOnly = false } = {},
) {
  const nav = page.getByRole('navigation', {
    name: mobile ? '工作空间导航' : '主要导航',
    exact: true,
  });
  const link = nav.getByRole('link', { name: label, exact: true });
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(link).toHaveAttribute('data-active');
  await expect(link).toHaveCSS('flex-direction', 'row');
  const active = await link.evaluate((element) => {
    const icon = element.querySelector('svg');
    const text = element.querySelector('span');
    if (!icon || !text) throw new Error('Navigation requires icon and label');
    const style = getComputedStyle(element);
    const iconBounds = icon.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    return {
      color: style.color,
      background: style.backgroundColor,
      iconColor: getComputedStyle(icon).color,
      iconRight: iconBounds.right,
      iconCenter: iconBounds.top + iconBounds.height / 2,
      textLeft: textBounds.left,
      textCenter: textBounds.top + textBounds.height / 2,
    };
  });
  const inactive = await nav
    .locator('a:not([aria-current="page"])')
    .first()
    .evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
    }));
  expect(active.color).not.toBe(inactive.color);
  expect(active.background).not.toBe(inactive.background);
  expect(active.iconColor).toBe(active.color);
  if (iconOnly) {
    await expect(link.locator('span')).toBeHidden();
  } else {
    expect(active.iconRight).toBeLessThan(active.textLeft);
    expect(Math.abs(active.iconCenter - active.textCenter)).toBeLessThanOrEqual(
      2,
    );
  }
}

test('login → create → attribute rule → evaluate → history → logout', async ({
  page,
}, testInfo) => {
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Use pnpm test:e2e for isolated credentials');
  await page.goto('/');
  await page
    .getByLabel('账号', { exact: true })
    .fill(process.env.E2E_ADMIN_USERNAME ?? 'e2e-admin');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '功能配置' })).toBeVisible();
  await expectNavigationRow(page, '功能配置');
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
  await expectNavigationRow(page, '评估控制台');
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
    path: testInfo.outputPath('d2-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: '切换为深色主题', exact: true })
    .click();
  await expectNavigationRow(page, '评估控制台');
  await page.setViewportSize({ width: 900, height: 900 });
  await expectNavigationRow(page, '评估控制台', { iconOnly: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNavigationRow(page, '评估控制台', { mobile: true });
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  await page.screenshot({
    path: testInfo.outputPath('d2-dark-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: '功能配置', exact: true }).click();
  await page.getByRole('link', { name: 'Checkout smoke', exact: true }).click();
  await page.getByRole('tab', { name: '操作历史', exact: true }).click();
  await expect(page.getByText('添加规则', { exact: true })).toBeVisible();
  await expect(page.getByText('创建配置', { exact: true })).toBeVisible();
  const auditEntry = page
    .getByRole('listitem')
    .filter({ has: page.getByText('添加规则', { exact: true }) });
  await expect(auditEntry).toContainText(
    '新增规则：优先级 1 · country 等于 "cn" → 开启（true）',
  );
  await auditEntry
    .getByRole('button', { name: '查看变更详情', exact: true })
    .click();
  await expect(
    auditEntry.getByRole('region', { name: '变更前后对比' }),
  ).toContainText('未配置');
  await expect(auditEntry.locator('pre')).toHaveCount(0);
  await auditEntry
    .getByRole('button', { name: '查看原始数据', exact: true })
    .click();
  await expect(
    auditEntry.getByRole('region', { name: '原始审计数据' }),
  ).toContainText('"ExpectedJSON"');
  const auditGeometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(auditGeometry.content).toBeLessThanOrEqual(auditGeometry.viewport);
  await page.screenshot({
    path: testInfo.outputPath('readable-history-dark-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '登录工作空间' }),
  ).toBeVisible();
});
