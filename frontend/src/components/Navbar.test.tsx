import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from './Navbar';
import { HealthStatus } from '../types';

describe('Navbar Component - Responsive Three-Dot Menu', () => {
  const healthyStatus: HealthStatus = {
    status: 'healthy',
    app: 'nutrilens-backend',
    version: '1.0.0',
    database: 'connected',
    ai_provider: 'gemini',
    timestamp: '2026-10-12T00:00:00Z',
  };

  const connectingStatus: HealthStatus = {
    status: 'degraded',
    app: 'nutrilens-backend',
    version: '1.0.0',
    database: 'connecting',
    ai_provider: 'gemini',
    timestamp: '2026-10-12T00:00:00Z',
  };

  it('1. Renders logo branding, three-dot trigger button, and keeps menu closed by default', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />);

    expect(screen.getByText('NutriLens')).toBeInTheDocument();
    expect(screen.getByText('AI Vision')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');

    // Navigation dropdown should not be rendered
    expect(screen.queryByRole('menu', { name: /navigation options/i })).not.toBeInTheDocument();
  });

  it('2. Opens menu when clicking the three-dot button and displays all 5 navigation options', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: /navigation options/i })).toBeInTheDocument();

    // Verify all 5 navigation options are present
    expect(screen.getByRole('menuitem', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /scan food/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile & goals/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /indian foods/i })).toBeInTheDocument();
  });

  it('3. Highlights the active section visually in the menu', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="dashboard" setActiveTab={setActiveTab} health={healthyStatus} />);

    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const dashboardItem = screen.getByRole('menuitem', { name: /dashboard/i });
    const overviewItem = screen.getByRole('menuitem', { name: /overview/i });

    expect(dashboardItem).toHaveClass('text-lime-primary');
    expect(dashboardItem).toHaveClass('font-semibold');
    expect(overviewItem).not.toHaveClass('text-lime-primary');
  });

  it('4. Navigates to selected section and closes the menu when an option is clicked', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />);

    // Open menu
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    // Click 'Scan Food'
    const scanOption = screen.getByRole('menuitem', { name: /scan food/i });
    await user.click(scanOption);

    expect(setActiveTab).toHaveBeenCalledWith('scan');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('5. Toggles menu closed when clicking the three-dot trigger button again', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('6. Closes menu when pressing Escape key and restores focus to trigger button', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('7. Closes menu when clicking outside', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <Navbar activeTab="home" setActiveTab={setActiveTab} health={healthyStatus} />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('8. Clicking brand logo navigates to home', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="profile" setActiveTab={setActiveTab} health={healthyStatus} />);

    const brandBtn = screen.getByRole('button', { name: /nutrilens home overview/i });
    await user.click(brandBtn);

    expect(setActiveTab).toHaveBeenCalledWith('home');
  });

  it('9. Correctly displays live API connected status when healthy', () => {
    render(<Navbar activeTab="home" setActiveTab={vi.fn()} health={healthyStatus} />);
    expect(screen.getByText('Live API Connected')).toBeInTheDocument();
  });

  it('10. Correctly displays connecting API status when degraded or null', () => {
    render(<Navbar activeTab="home" setActiveTab={vi.fn()} health={connectingStatus} />);
    expect(screen.getByText('Connecting to API...')).toBeInTheDocument();
  });
});
