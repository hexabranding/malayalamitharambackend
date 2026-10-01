const express = require("express");
const Category = require("../models/Category");
const Article = require("../models/Article");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * GET ALL CATEGORIES
 * Returns categories in group -> children structure
 */
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ slug: 1 })
      .lean();

    const withCounts = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        count: await Article.countDocuments({
          category: cat.slug,
          published: true,
        }),
      }))
    );

    const groups = withCounts.filter((c) => !c.parent);
    const children = withCounts.filter((c) => c.parent);

    const hierarchical = groups.map((group) => ({
      ...group,
      children: children
        .filter((child) => child.parent === group.slug)
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    }));

    res.json(hierarchical);
  } catch (err) {
    console.error("Get categories error:", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});


/**
 * CREATE CATEGORY / GROUP / SUBCATEGORY
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      label,
      slug,
      titleMl,
      parent,
    } = req.body;

    // Required fields
    if (!label || !label.trim()) {
      return res.status(400).json({
        error: "label is required",
      });
    }

    if (!slug || !slug.trim()) {
      return res.status(400).json({
        error: "slug is required",
      });
    }

    const cleanLabel = label.trim();
    const cleanSlug = slug.trim();

    // Check duplicate slug
    const existing = await Category.findOne({
      slug: cleanSlug,
    });

    if (existing) {
      return res.status(409).json({
        error: "Category already exists",
      });
    }

    // If parent is supplied, verify parent exists
    if (parent) {
      const parentCategory = await Category.findOne({
        slug: parent,
      });

      if (!parentCategory) {
        return res.status(400).json({
          error: "Parent category not found",
        });
      }
    }

    const category = await Category.create({
      label: cleanLabel,
      slug: cleanSlug,
      titleMl: titleMl ? titleMl.trim() : "",
      parent: parent || null,
    });

    return res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        error: "A category with this slug already exists",
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to create category",
    });
  }
});


/**
 * UPDATE CATEGORY
 *
 * URL:
 * PUT /api/categories/:slug
 *
 * The :slug is the OLD slug.
 */
router.put("/:slug", authMiddleware, async (req, res) => {
  try {
    const oldSlug = req.params.slug;

    const {
      label,
      titleMl,
      slug: requestedSlug,
    } = req.body;

    // Validate label
    if (!label || !label.trim()) {
      return res.status(400).json({
        error: "label is required",
      });
    }

    // Find existing category using OLD slug
    const category = await Category.findOne({
      slug: oldSlug,
    });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    // Use existing slug if new slug wasn't supplied
    const newSlug =
      requestedSlug && requestedSlug.trim()
        ? requestedSlug.trim()
        : oldSlug;

    // Check duplicate slug only if slug changes
    if (newSlug !== oldSlug) {
      const duplicate = await Category.findOne({
        slug: newSlug,
        _id: { $ne: category._id },
      });

      if (duplicate) {
        return res.status(409).json({
          error: "A category with this slug already exists",
        });
      }
    }

    const wasGroup = !category.parent;

    // Update basic fields
    category.label = label.trim();
    category.titleMl = titleMl ? titleMl.trim() : "";

    // Update slug if changed
    if (newSlug !== oldSlug) {
      category.slug = newSlug;
    }

    await category.save();

    /**
     * If a GROUP slug changes,
     * update all child categories' parent field.
     */
    if (wasGroup && newSlug !== oldSlug) {
      await Category.updateMany(
        {
          parent: oldSlug,
        },
        {
          $set: {
            parent: newSlug,
          },
        }
      );
    }

    /**
     * If category slug changes,
     * update article references.
     */
    if (newSlug !== oldSlug) {
      await Article.updateMany(
        {
          category: oldSlug,
        },
        {
          $set: {
            category: newSlug,
          },
        }
      );

      /**
       * Update categories array references.
       */
      await Article.updateMany(
        {
          categories: oldSlug,
        },
        {
          $set: {
            "categories.$[category]": newSlug,
          },
        },
        {
          arrayFilters: [
            {
              category: oldSlug,
            },
          ],
        }
      );
    }

    // Return updated category
    const updated = await Category.findOne({
      slug: newSlug,
    }).lean();

    return res.json(updated);
  } catch (error) {
    console.error("Category update error:", error);

    // Duplicate slug
    if (error.code === 11000) {
      return res.status(409).json({
        error: "A category with this slug already exists",
      });
    }

    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
});


/**
 * DELETE CATEGORY
 *
 * URL:
 * DELETE /api/categories/:slug
 */
router.delete("/:slug", authMiddleware, async (req, res) => {
  try {
    const slug = req.params.slug;

    // Find category first
    const category = await Category.findOne({
      slug,
    });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    const isGroup = !category.parent;

    // Delete the category using MongoDB _id
    await Category.deleteOne({
      _id: category._id,
    });

    /**
     * If this is a parent group,
     * delete all its children.
     */
    if (isGroup) {
      await Category.deleteMany({
        parent: slug,
      });
    }

    return res.json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Category delete error:", error);

    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
});


/**
 * MIGRATE OLD CATEGORY DATA
 *
 * Removes old "id" fields from categories.
 *
 * Run only once if old categories contain id.
 */
router.post("/migrate", authMiddleware, async (req, res) => {
  try {
    const result = await Category.updateMany(
      {},
      {
        $unset: {
          id: "",
        },
      }
    );

    return res.json({
      message: "Category migration complete",
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error("Category migration error:", error);

    return res.status(500).json({
      error: error.message || "Migration failed",
    });
  }
});


module.exports = router;