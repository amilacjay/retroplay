import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tour } from '../components/Tour';

afterEach(() => cleanup());

// jsdom lays nothing out, so give the elements the tour looks for a size.
function target(className: string) {
  const element = document.createElement('div');
  element.className = className;
  element.getBoundingClientRect = () => ({ top: 100, left: 100, width: 200, height: 40, right: 300, bottom: 140, x: 100, y: 100, toJSON: () => ({}) } as DOMRect);
  document.body.append(element);
  return element;
}

describe('first-visit tour', () => {
  it('walks through the machine, model, and album art steps, then closes', () => {
    const toolbar = target('stage-toolbar'); toolbar.append(target('segmented'));
    const model = target('model-button');
    const onClose = vi.fn();
    render(<Tour open theme="cassette" artwork={null} onClose={onClose}/>);
    expect(screen.getByRole('heading', { name: 'Welcome to the listening room' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByRole('heading', { name: 'Tape or vinyl' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Hi-Fi');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Without album art the sleeve step points at the model button and says where the Sleeve menu will appear.
    expect(screen.getByRole('heading', { name: 'Fit the album art' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('a Sleeve button appears');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // No album case on stage, so "Move the case" is skipped.
    expect(screen.getByRole('heading', { name: 'Find something to play' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    toolbar.remove(); model.remove();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<Tour open={false} theme="vinyl" artwork={null} onClose={() => {}}/>);
    expect(container).toBeEmptyDOMElement();
  });
});
