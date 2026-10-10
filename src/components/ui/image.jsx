import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * @typedef {React.ImgHTMLAttributes<HTMLImageElement> & {
 *   fittingType?: string, originWidth?: number, originHeight?: number,
 *   focalPointX?: number, focalPointY?: number, quality?: number
 * }} ImageProps
 */

/** @type {React.ForwardRefExoticComponent<ImageProps & React.RefAttributes<HTMLImageElement>>} */
const Image = React.forwardRef(function Image({
  src, fittingType = 'fill', originWidth, originHeight,
  focalPointX, focalPointY, quality, className, style, onError, ...props
}, ref) {
  const [failedSource, setFailedSource] = React.useState(null);
  let localSource = false;
  if (src) {
    try {
      const url = new URL(src, window.location.origin);
      localSource = url.origin === window.location.origin || url.protocol === 'blob:' || url.protocol === 'data:';
    } catch {
      localSource = false;
    }
  }
  const failed = src && (failedSource === src || !localSource);
  return (
    <img {...props} ref={ref}
      src={!src || failed ? '/image-placeholder.svg' : src}
      className={cn(fittingType === 'fit' ? 'object-contain' : 'object-cover', className)}
      style={{ ...style, ...(originWidth && originHeight ? { aspectRatio: `${originWidth} / ${originHeight}` } : {}) }}
      onError={(event) => {
        if (failed) return;
        setFailedSource(src);
        onError?.(event);
      }}
      data-error-image={failed || undefined}
    />
  );
});

export { Image };
