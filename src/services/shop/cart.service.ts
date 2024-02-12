import { inject, injectable } from "inversify";
import { BaseService } from "../base.service";
import { Logger } from "../../utils/logger";
import { Cart, CartItem, CartModel } from "../../models/shop/cart/Cart";

@injectable()
export class CartService extends BaseService {
    public constructor(@inject(Logger) logger: Logger) {
        super(logger);
    }

    public async createCart(cart: Cart) {
        return await CartModel.create(cart);
    }

    public async updateCart(userId: string, cart: Cart) {
        return await CartModel.findOneAndUpdate({ userId }, cart, { new: true });
    }

    public async deleteCart(userId: string) {
        return await CartModel.findOneAndDelete({ userId });
    }

    public async getCartById(cartId: string) {
        return await CartModel.findById(cartId).populate("items.productId");
    }
    public async getCartByUserId(userId: string) {
        return await CartModel.findOne({ userId }).populate("items.productId");
    }
    public async getCartByUserIdAndProductId(userId: string, productId: string) {
        return await CartModel.findOne({ userId, "items.productId": productId });
    }
    public async addItemToCart(userId: string, item: CartItem) {
        try {
            return await CartModel.findOneAndUpdate(
                { userId },
                { $push: { items: item } },
                { new: true, upsert: true},
            );
        } catch (err) {
            console.log("Hi");
            console.log(err);
        }
    }
    public async updateCartItem(
        userId: string,
        productId: string,
        item: CartItem,
    ) {
        return await CartModel.findOneAndUpdate(
            { userId, "items.productId": productId },
            { $set: { "items.$": item } },
            { new: true },
        );
    }
    public async deleteCartItem(userId: string, productId: string) {
        return await CartModel.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId } } },
            { new: true },
        );
    }
    public async clearCart(userId: string) {
        return await CartModel.findOneAndUpdate(
            { userId },
            { items: [] },
            { new: true },
        );
    }
    public async calculateCartTotal(userId: string) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total;
    }
    public async calculateCartTotalWithShipping(userId: string) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total + 10;
    }
    public async calculateCartTotalWithTax(userId: string) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total * 1.1;
    }
    public async calculateCartTotalWithShippingAndTax(userId: string) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total * 1.1 + 10;
    }

    public async calculateCartTotalWithDiscount(
        userId: string,
        discount: number,
    ) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total - discount;
    }

    public async calculateCartTotalWithShippingAndDiscount(
        userId: string,
        discount: number,
    ) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return total - discount + 10;
    }

    public async calculateCartTotalWithTaxAndDiscount(
        userId: string,
        discount: number,
    ) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return (total - discount) * 1.1;
    }

    public async calculateCartTotalWithShippingAndTaxAndDiscount(
        userId: string,
        discount: number,
    ) {
        const cart = await CartModel.findOne({ userId });
        if (!cart) {
            return 0;
        }
        const total = cart.items.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0,
        );
        return (total - discount) * 1.1 + 10;
    }
}
