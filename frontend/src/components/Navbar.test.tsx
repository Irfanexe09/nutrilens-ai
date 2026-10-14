import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from './Navbar';

describe('Navbar Component - Minimal Navigation', () => {
  it('1. Renders clean NutriLens branding and keeps dropdown menu closed by default', () => {
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

    expect(screen.getByText('NutriLens')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');

    // Navigation dropdown should not be rendered
    expect(screen.queryByRole('menu', { name: /navigation options/i })).not.toBeInTheDocument();
  });

  it('2. Opens menu when clicking the three-dot button and displays the 4 primary navigation options', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: /navigation options/i })).toBeInTheDocument();

    // Verify all 4 primary navigation options are present in menu
    expect(screen.getByRole('menuitem', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^scan food$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^history$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^profile$/i })).toBeInTheDocument();
  });

  it('3. Highlights the active section visually in the menu', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="scan" setActiveTab={setActiveTab} />);

    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const scanItem = screen.getByRole('menuitem', { name: /^scan food$/i });
    const homeItem = screen.getByRole('menuitem', { name: /^home$/i });

    expect(scanItem).toHaveClass('text-lime-primary');
    expect(scanItem).toHaveClass('font-semibold');
    expect(homeItem).not.toHaveClass('text-lime-primary');
  });

  it('4. Navigates to selected section and closes the menu when an option is clicked', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

    // Open menu
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

    // Click 'Scan Food'
    const scanOption = screen.getByRole('menuitem', { name: /^scan food$/i });
    await user.click(scanOption);

    expect(setActiveTab).toHaveBeenCalledWith('scan');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('5. Toggles menu closed when clicking the three-dot trigger button again', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('6. Closes menu when pressing Escape key and restores focus to trigger button', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

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
        <Navbar activeTab="home" setActiveTab={setActiveTab} />
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
    render(<Navbar activeTab="profile" setActiveTab={setActiveTab} />);

    const brandBtn = screen.getByRole('button', { name: /nutrilens home overview/i });
    await user.click(brandBtn);

    expect(setActiveTab).toHaveBeenCalledWith('home');
  });

  it('9. Desktop navigation bar contains quick navigation buttons', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    render(<Navbar activeTab="home" setActiveTab={setActiveTab} />);

    const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(mainNav).toBeInTheDocument();

    // Click direct button in main navigation
    const historyBtn = screen.getByRole('button', { name: /history/i });
    await user.click(historyBtn);

    expect(setActiveTab).toHaveBeenCalledWith('history');
  });
});
