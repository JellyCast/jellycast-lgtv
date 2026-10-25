import { icons, type IconName } from '../icons'

export function Icon({ name, size, class: className }: { name: IconName; size: number; class?: string }) {
    const icon = icons[name]
    return (
        <svg
            class={className}
            width={size}
            height={size}
            viewBox={icon.viewBox}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: icon.body }}
        />
    )
}
