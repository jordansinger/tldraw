import * as React from 'react'
import { useGesture, Handler } from '@use-gesture/react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react-lite'
import { Vec } from '@tldraw/vec'
import { Brush } from '../Brush'
import { Indicator } from '../Indicator'
import { Shape } from '../Shape'
import { useCameraCss, useResizeObserver, useContext } from '~hooks'
import { TLNuBinding, TLNuBounds, TLNuBoundsComponent, TLNuTargetType } from '~types'
import type { TLNuShape } from '~nu-lib'

type CanvasProps<S extends TLNuShape = TLNuShape, B extends TLNuBinding = TLNuBinding> = {
  shapes: S[]
  bindings: B[]
  selectedShapes: S[]
  hoveredShape?: S
  selectedBounds?: TLNuBounds
  brush?: TLNuBounds
  BoundsComponent?: TLNuBoundsComponent<S>
}

export const Canvas = observer(function Canvas({
  shapes,
  bindings,
  selectedShapes,
  hoveredShape,
  selectedBounds,
  brush,
}: CanvasProps) {
  const rContainer = React.useRef<HTMLDivElement>(null)
  const rLayer = React.useRef<HTMLDivElement>(null)
  const { viewport, inputs, callbacks, components } = useContext()

  useResizeObserver(rContainer, viewport)

  useCameraCss(rLayer, rContainer, viewport)

  const handleWheel = React.useCallback<Handler<'wheel', WheelEvent>>(({ delta, event: e }) => {
    e.preventDefault()
    if (Vec.isEqual(delta, [0, 0])) return
    viewport.panCamera(delta)
    inputs.onPointerMove([...viewport.getPagePoint([e.clientX, e.clientY]), 0.5], e as any)
    callbacks.onPan?.({ type: TLNuTargetType.Canvas, order: 0 }, e)
  }, [])

  useGesture(
    {
      onWheel: handleWheel,
    },
    {
      target: rContainer,
      eventOptions: { passive: false },
      pinch: {
        from: viewport.camera.zoom,
        scaleBounds: () => ({ from: viewport.camera.zoom, max: 5, min: 0.1 }),
      },
    }
  )

  const events = React.useMemo(() => {
    const onPointerMove: React.PointerEventHandler = (e) => {
      inputs.onPointerMove([...viewport.getPagePoint([e.clientX, e.clientY]), e.pressure ?? 0.5], e)
      callbacks.onPointerMove?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onPointerDown: React.PointerEventHandler = (e) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      inputs.onPointerDown([...viewport.getPagePoint([e.clientX, e.clientY]), e.pressure ?? 0.5], e)
      callbacks.onPointerDown?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onPointerUp: React.PointerEventHandler = (e) => {
      e.currentTarget.releasePointerCapture(e.pointerId)
      inputs.onPointerUp([...viewport.getPagePoint([e.clientX, e.clientY]), e.pressure ?? 0.5], e)
      callbacks.onPointerUp?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onKeyDown: React.KeyboardEventHandler = (e) => {
      inputs.onKeyDown(e)
      callbacks.onKeyDown?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onKeyUp: React.KeyboardEventHandler = (e) => {
      inputs.onKeyUp(e)
      callbacks.onKeyUp?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onPointerEnter: React.PointerEventHandler = (e) => {
      callbacks.onPointerEnter?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    const onPointerLeave: React.PointerEventHandler = (e) => {
      callbacks.onPointerLeave?.({ type: TLNuTargetType.Canvas, order: e.detail }, e)
    }

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onKeyDown,
      onKeyUp,
      onPointerEnter,
      onPointerLeave,
    }
  }, [inputs])

  return (
    <div ref={rContainer} tabIndex={-1} className="nu-absolute nu-canvas" {...events}>
      <SVGLayer>
        {selectedBounds && (
          <components.boundsBackground shapes={selectedShapes} bounds={selectedBounds} />
        )}
      </SVGLayer>
      <div ref={rLayer} className="nu-absolute nu-layer">
        {shapes.map((shape, i) => (
          <Shape key={'shape_' + shape.id} shape={shape} zIndex={i} />
        ))}
      </div>
      <SVGLayer>
        {selectedShapes.map((shape) => (
          <Indicator key={'selected_indicator_' + shape.id} shape={shape} />
        ))}
        {hoveredShape && (
          <Indicator key={'hovered_indicator_' + hoveredShape.id} shape={hoveredShape} />
        )}
        {selectedBounds && (
          <components.boundsForeground shapes={selectedShapes} bounds={selectedBounds} />
        )}
        {brush && <Brush brush={brush} />}
      </SVGLayer>
    </div>
  )
})

interface SVGLayerProps {
  children: React.ReactNode
}

const SVGLayer = observer(function SVGLayer({ children }: SVGLayerProps) {
  const rGroup = React.useRef<SVGGElement>(null)

  const { viewport } = useContext()

  React.useEffect(
    () =>
      autorun(() => {
        const group = rGroup.current
        if (!group) return

        const { zoom, point } = viewport.camera
        group.style.setProperty(
          'transform',
          `scale(${zoom}) translateX(${point[0]}px) translateY(${point[1]}px)`
        )
      }),
    []
  )

  return (
    <svg className="nu-absolute nu-overlay" pointerEvents="none">
      <g ref={rGroup} pointerEvents="none">
        {children}
      </g>
    </svg>
  )
})
