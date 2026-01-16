import 'reflect-metadata';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = any> = new (...args: any[]) => T;

export class Container {
  private static instances = new Map<Constructor, unknown>();

  static get<T>(target: Constructor<T>): T {
    if (this.instances.has(target)) {
      return this.instances.get(target) as T;
    }

    const tokens: Constructor[] = Reflect.getMetadata('design:paramtypes', target) || [];

    const injections = tokens.map((token) => Container.get(token));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new target(...(injections as any[]));
    this.instances.set(target, instance);

    return instance;
  }
}

export function Injectable(): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-function-type
  return (_target: Function) => {};
}
